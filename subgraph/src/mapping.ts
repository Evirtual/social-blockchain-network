import { Address, BigInt, ByteArray, Bytes, JSONValueKind, json, ipfs } from "@graphprotocol/graph-ts";

import {
  Followed,
  PostFrozen,
  PostMinted,
  PostUpdated,
  PostUpdatedByAdmin,
  PostBurned,
  PostBurnedByAdmin,
  PostLiked,
  PostUnliked,
  PostSaved,
  PostUnsaved,
  PostCommented,
  PostTipped,
  PosterAllowed,
  PosterApprovalRequested,
  ProfileClearedByAdmin,
  ProfileModerated,
  ProfileUpdated,
  TipsWithdrawn,
  Unfollowed
} from "../generated/SocialPosts/SocialPosts";

import {
  Account,
  Comment,
  FollowEdge,
  LikeEdge,
  Post,
  SaveEdge,
  Tip,
  Withdrawal,
  GlobalStats
} from "../generated/schema";

const GLOBAL_STATS_ID = "global";
const DATA_URI_PREFIX = "data:application/json;base64,";

function getOrCreateGlobalStats(): GlobalStats {
  let s = GlobalStats.load(GLOBAL_STATS_ID);
  if (s == null) {
    s = new GlobalStats(GLOBAL_STATS_ID);
    s.totalAccounts = BigInt.zero();
    s.totalPosts = BigInt.zero();
    s.totalLikes = BigInt.zero();
    s.totalComments = BigInt.zero();
    s.totalSaves = BigInt.zero();
    s.totalTipsWei = BigInt.zero();
  }
  return s as GlobalStats;
}

function getOrCreateAccount(address: Address, blockNumber: BigInt, timestamp: BigInt): Account {
  const id = address.toHexString();
  let a = Account.load(id);
  if (a == null) {
    a = new Account(id);
    a.name = null;
    a.bio = null;
    a.avatar = null;

    a.posterAllowed = false;
    a.posterRequested = false;
    a.disapprovedEver = false;

    a.followersCount = BigInt.zero();
    a.followingCount = BigInt.zero();
    a.postedCount = BigInt.zero();
    a.likedCount = BigInt.zero();
    a.savedCount = BigInt.zero();
    a.commentsCount = BigInt.zero();

    a.withdrawableWeiIndexed = BigInt.zero();

    a.updatedAtBlock = null;
    a.updatedAtTimestamp = null;

    const stats = getOrCreateGlobalStats();
    stats.totalAccounts = stats.totalAccounts.plus(BigInt.fromI32(1));
    stats.save();
  }

  a.updatedAtBlock = blockNumber;
  a.updatedAtTimestamp = timestamp;

  return a as Account;
}

function getOrCreatePost(tokenId: BigInt): Post {
  const id = tokenId.toString();
  let p = Post.load(id);
  if (p == null) {
    p = new Post(id);
    p.tokenId = id;
    p.tokenURI = "";
    p.title = "";
    p.body = "";
    p.mintBlockNumber = BigInt.zero();
    p.mintTimestamp = null;
    p.likes = BigInt.zero();
    p.comments = BigInt.zero();
    p.saves = BigInt.zero();
    p.tipsWei = BigInt.zero();
    p.frozenAtBlock = null;
    p.burnedAtBlock = null;
    p.updatedAtBlock = null;
    p.author = null;
    p.mintTxHash = null;
  }
  return p as Post;
}

function getEdgeId(tokenId: BigInt, account: Address): string {
  return tokenId.toString() + "-" + account.toHexString();
}

function getFollowEdgeId(follower: Address, followee: Address): string {
  return follower.toHexString() + "-" + followee.toHexString();
}

function getLogId(txHashHex: string, logIndex: BigInt): string {
  return txHashHex + "-" + logIndex.toString();
}

function decodeBase64Char(code: i32): i32 {
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97 + 26;
  if (code >= 48 && code <= 57) return code - 48 + 52;
  if (code == 43) return 62;
  if (code == 47) return 63;
  return -1;
}

function decodeBase64(data: string): Bytes | null {
  const len = data.length;
  if (len == 0 || len % 4 != 0) return null;

  let padding = 0;
  if (data.charCodeAt(len - 1) == 61) padding += 1;
  if (data.charCodeAt(len - 2) == 61) padding += 1;

  const outLen = (len / 4) * 3 - padding;
  const out = new ByteArray(outLen);
  let outIndex = 0;

  for (let i = 0; i < len; i += 4) {
    const c1 = data.charCodeAt(i);
    const c2 = data.charCodeAt(i + 1);
    const c3 = data.charCodeAt(i + 2);
    const c4 = data.charCodeAt(i + 3);

    const n1 = decodeBase64Char(c1);
    const n2 = decodeBase64Char(c2);
    const n3 = c3 == 61 ? 0 : decodeBase64Char(c3);
    const n4 = c4 == 61 ? 0 : decodeBase64Char(c4);

    if (n1 < 0 || n2 < 0 || (c3 != 61 && n3 < 0) || (c4 != 61 && n4 < 0)) return null;

    const triple = (n1 << 18) | (n2 << 12) | (n3 << 6) | n4;

    if (outIndex < outLen) out[outIndex++] = ((triple >> 16) & 0xff) as u8;
    if (outIndex < outLen) out[outIndex++] = ((triple >> 8) & 0xff) as u8;
    if (outIndex < outLen) out[outIndex++] = (triple & 0xff) as u8;
  }

  return Bytes.fromByteArray(out);
}

function applyMetadataFromJson(post: Post, data: Bytes): void {
  const parsed = json.try_fromBytes(data);
  if (!parsed.isOk) return;

  const value = parsed.value;
  if (value.kind != JSONValueKind.OBJECT) return;

  const obj = value.toObject();
  const name = obj.get("name");
  if (name !== null && name.kind == JSONValueKind.STRING) {
    post.title = name.toString();
  }
  const description = obj.get("description");
  if (description !== null && description.kind == JSONValueKind.STRING) {
    post.body = description.toString();
  }
}

function extractIpfsPath(tokenURI: string): string | null {
  if (!tokenURI.startsWith("ipfs://")) return null;
  let path = tokenURI.slice(7);
  if (path.startsWith("ipfs/")) path = path.slice(5);
  return path.length > 0 ? path : null;
}

function applyMetadataFromTokenURI(post: Post, tokenURI: string): void {
  if (!tokenURI) return;

  if (tokenURI.startsWith(DATA_URI_PREFIX)) {
    const encoded = tokenURI.slice(DATA_URI_PREFIX.length);
    const data = decodeBase64(encoded);
    if (data !== null) applyMetadataFromJson(post, data);
    return;
  }

  const ipfsPath = extractIpfsPath(tokenURI);
  if (ipfsPath !== null) {
    const data = ipfs.cat(ipfsPath);
    if (data !== null) applyMetadataFromJson(post, data as Bytes);
  }
}

export function handlePosterAllowed(event: PosterAllowed): void {
  const a = getOrCreateAccount(event.params.account, event.block.number, event.block.timestamp);

  a.posterAllowed = event.params.allowed;
  a.posterRequested = false;
  if (!event.params.allowed) {
    a.disapprovedEver = true;
  }

  a.save();
}

export function handlePosterApprovalRequested(event: PosterApprovalRequested): void {
  const a = getOrCreateAccount(event.params.account, event.block.number, event.block.timestamp);
  a.posterRequested = true;
  a.save();
}

export function handleProfileUpdated(event: ProfileUpdated): void {
  const a = getOrCreateAccount(event.params.account, event.block.number, event.block.timestamp);
  a.name = event.params.name;
  a.bio = event.params.bio;
  a.avatar = event.params.avatar;
  a.save();
}

export function handleProfileModerated(event: ProfileModerated): void {
  const a = getOrCreateAccount(event.params.account, event.block.number, event.block.timestamp);
  a.name = event.params.name;
  a.bio = event.params.bio;
  a.avatar = event.params.avatar;
  a.save();
}

export function handleProfileClearedByAdmin(event: ProfileClearedByAdmin): void {
  const a = getOrCreateAccount(event.params.account, event.block.number, event.block.timestamp);
  a.name = null;
  a.bio = null;
  a.avatar = null;
  a.save();
}

export function handleFollowed(event: Followed): void {
  const follower = getOrCreateAccount(event.params.follower, event.block.number, event.block.timestamp);
  const followee = getOrCreateAccount(event.params.followee, event.block.number, event.block.timestamp);

  const edgeId = getFollowEdgeId(event.params.follower, event.params.followee);
  let edge = FollowEdge.load(edgeId);
  if (edge == null) {
    edge = new FollowEdge(edgeId);
    edge.follower = follower.id;
    edge.followee = followee.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  if (!edge.active) {
    edge.active = true;
    follower.followingCount = follower.followingCount.plus(BigInt.fromI32(1));
    followee.followersCount = followee.followersCount.plus(BigInt.fromI32(1));
  }

  edge.updatedAtBlock = event.block.number;

  follower.save();
  followee.save();
  edge.save();
}

export function handleUnfollowed(event: Unfollowed): void {
  const follower = getOrCreateAccount(event.params.follower, event.block.number, event.block.timestamp);
  const followee = getOrCreateAccount(event.params.followee, event.block.number, event.block.timestamp);

  const edgeId = getFollowEdgeId(event.params.follower, event.params.followee);
  let edge = FollowEdge.load(edgeId);
  if (edge == null) {
    edge = new FollowEdge(edgeId);
    edge.follower = follower.id;
    edge.followee = followee.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  if (edge.active) {
    edge.active = false;
    if (follower.followingCount.gt(BigInt.zero())) {
      follower.followingCount = follower.followingCount.minus(BigInt.fromI32(1));
    }
    if (followee.followersCount.gt(BigInt.zero())) {
      followee.followersCount = followee.followersCount.minus(BigInt.fromI32(1));
    }
  }

  edge.updatedAtBlock = event.block.number;

  follower.save();
  followee.save();
  edge.save();
}

export function handlePostMinted(event: PostMinted): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const author = getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp);

  p.author = event.params.author;
  p.title = event.params.title;
  p.body = event.params.body;
  p.tokenURI = event.params.tokenURI;
  if (p.title.length == 0 || p.body.length == 0) {
    applyMetadataFromTokenURI(p, p.tokenURI);
  }
  p.mintTxHash = event.transaction.hash;
  p.mintBlockNumber = event.block.number;
  p.mintTimestamp = event.block.timestamp;
  p.burnedAtBlock = null;
  p.updatedAtBlock = event.block.number;

  author.postedCount = author.postedCount.plus(BigInt.fromI32(1));
  const stats = getOrCreateGlobalStats();
  stats.totalPosts = stats.totalPosts.plus(BigInt.fromI32(1));
  stats.save();

  author.save();
  p.save();
}

export function handlePostUpdated(event: PostUpdated): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp).save();

  p.author = event.params.author;
  p.title = event.params.title;
  p.body = event.params.body;
  p.tokenURI = event.params.tokenURI;
  if (p.title.length == 0 || p.body.length == 0) {
    applyMetadataFromTokenURI(p, p.tokenURI);
  }
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostUpdatedByAdmin(event: PostUpdatedByAdmin): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp).save();

  p.author = event.params.author;
  p.title = event.params.title;
  p.body = event.params.body;
  p.tokenURI = event.params.tokenURI;
  if (p.title.length == 0 || p.body.length == 0) {
    applyMetadataFromTokenURI(p, p.tokenURI);
  }
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostFrozen(event: PostFrozen): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  p.frozenAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostBurned(event: PostBurned): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);
  const author = getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp);

  p.burnedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  if (author.postedCount.gt(BigInt.zero())) {
    author.postedCount = author.postedCount.minus(BigInt.fromI32(1));
  }
  const stats = getOrCreateGlobalStats();
  if (stats.totalPosts.gt(BigInt.zero())) {
    stats.totalPosts = stats.totalPosts.minus(BigInt.fromI32(1));
  }
  stats.save();

  author.save();
  p.save();
}

export function handlePostBurnedByAdmin(event: PostBurnedByAdmin): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);
  const author = getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp);

  p.burnedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  if (author.postedCount.gt(BigInt.zero())) {
    author.postedCount = author.postedCount.minus(BigInt.fromI32(1));
  }
  const stats = getOrCreateGlobalStats();
  if (stats.totalPosts.gt(BigInt.zero())) {
    stats.totalPosts = stats.totalPosts.minus(BigInt.fromI32(1));
  }
  stats.save();

  author.save();
  p.save();
}

export function handlePostLiked(event: PostLiked): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const a = getOrCreateAccount(event.params.liker, event.block.number, event.block.timestamp);
  const edgeId = getEdgeId(tokenId, event.params.liker);
  let edge = LikeEdge.load(edgeId);
  if (edge == null) {
    edge = new LikeEdge(edgeId);
    edge.tokenId = tokenId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  if (!edge.active) {
    edge.active = true;
    p.likes = p.likes.plus(BigInt.fromI32(1));
    a.likedCount = a.likedCount.plus(BigInt.fromI32(1));
    const stats = getOrCreateGlobalStats();
    stats.totalLikes = stats.totalLikes.plus(BigInt.fromI32(1));
    stats.save();
  }

  edge.updatedAtBlock = event.block.number;

  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handlePostUnliked(event: PostUnliked): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const a = getOrCreateAccount(event.params.unliker, event.block.number, event.block.timestamp);
  const edgeId = getEdgeId(tokenId, event.params.unliker);
  let edge = LikeEdge.load(edgeId);
  if (edge == null) {
    edge = new LikeEdge(edgeId);
    edge.tokenId = tokenId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  if (edge.active) {
    edge.active = false;
    if (p.likes.gt(BigInt.zero())) {
      p.likes = p.likes.minus(BigInt.fromI32(1));
    }
    if (a.likedCount.gt(BigInt.zero())) {
      a.likedCount = a.likedCount.minus(BigInt.fromI32(1));
    }
    const stats = getOrCreateGlobalStats();
    if (stats.totalLikes.gt(BigInt.zero())) {
      stats.totalLikes = stats.totalLikes.minus(BigInt.fromI32(1));
    }
    stats.save();
  }

  edge.updatedAtBlock = event.block.number;

  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handlePostSaved(event: PostSaved): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const a = getOrCreateAccount(event.params.saver, event.block.number, event.block.timestamp);
  const edgeId = getEdgeId(tokenId, event.params.saver);
  let edge = SaveEdge.load(edgeId);
  if (edge == null) {
    edge = new SaveEdge(edgeId);
    edge.tokenId = tokenId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  if (!edge.active) {
    edge.active = true;
    p.saves = p.saves.plus(BigInt.fromI32(1));
    a.savedCount = a.savedCount.plus(BigInt.fromI32(1));
    const stats = getOrCreateGlobalStats();
    stats.totalSaves = stats.totalSaves.plus(BigInt.fromI32(1));
    stats.save();
  }

  edge.updatedAtBlock = event.block.number;

  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handlePostUnsaved(event: PostUnsaved): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const a = getOrCreateAccount(event.params.unsaver, event.block.number, event.block.timestamp);
  const edgeId = getEdgeId(tokenId, event.params.unsaver);
  let edge = SaveEdge.load(edgeId);
  if (edge == null) {
    edge = new SaveEdge(edgeId);
    edge.tokenId = tokenId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  if (edge.active) {
    edge.active = false;
    if (p.saves.gt(BigInt.zero())) {
      p.saves = p.saves.minus(BigInt.fromI32(1));
    }
    if (a.savedCount.gt(BigInt.zero())) {
      a.savedCount = a.savedCount.minus(BigInt.fromI32(1));
    }
    const stats = getOrCreateGlobalStats();
    if (stats.totalSaves.gt(BigInt.zero())) {
      stats.totalSaves = stats.totalSaves.minus(BigInt.fromI32(1));
    }
    stats.save();
  }

  edge.updatedAtBlock = event.block.number;

  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handlePostCommented(event: PostCommented): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const commenter = getOrCreateAccount(event.params.commenter, event.block.number, event.block.timestamp);
  const commentId = getLogId(event.transaction.hash.toHexString(), event.logIndex);
  let c = Comment.load(commentId);
  if (c == null) {
    c = new Comment(commentId);
    c.tokenId = tokenId.toString();
    c.commenter = commenter.id;
    c.comment = event.params.comment;
    c.txHash = event.transaction.hash;
    c.blockNumber = event.block.number;
    c.timestamp = event.block.timestamp;

    p.comments = p.comments.plus(BigInt.fromI32(1));
    commenter.commentsCount = commenter.commentsCount.plus(BigInt.fromI32(1));
    const stats = getOrCreateGlobalStats();
    stats.totalComments = stats.totalComments.plus(BigInt.fromI32(1));
    stats.save();
  }

  p.updatedAtBlock = event.block.number;

  commenter.save();
  c.save();
  p.save();
}

export function handlePostTipped(event: PostTipped): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const tipper = getOrCreateAccount(event.params.tipper, event.block.number, event.block.timestamp);
  const author = getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp);

  const tipId = getLogId(event.transaction.hash.toHexString(), event.logIndex);
  let t = Tip.load(tipId);
  if (t == null) {
    t = new Tip(tipId);
    t.tokenId = tokenId.toString();
    t.tipper = tipper.id;
    t.author = author.id;
    t.amountWei = event.params.amountWei;
    t.txHash = event.transaction.hash;
    t.blockNumber = event.block.number;
    t.timestamp = event.block.timestamp;

    p.tipsWei = p.tipsWei.plus(event.params.amountWei);
    author.withdrawableWeiIndexed = author.withdrawableWeiIndexed.plus(event.params.amountWei);
    const stats = getOrCreateGlobalStats();
    stats.totalTipsWei = stats.totalTipsWei.plus(event.params.amountWei);
    stats.save();
  }

  p.updatedAtBlock = event.block.number;

  tipper.save();
  author.save();
  t.save();
  p.save();
}

export function handleTipsWithdrawn(event: TipsWithdrawn): void {
  const author = getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp);

  const withdrawalId = getLogId(event.transaction.hash.toHexString(), event.logIndex);
  let w = Withdrawal.load(withdrawalId);
  if (w == null) {
    w = new Withdrawal(withdrawalId);
    w.author = author.id;
    w.amountWei = event.params.amountWei;
    w.txHash = event.transaction.hash;
    w.blockNumber = event.block.number;
    w.timestamp = event.block.timestamp;

    if (author.withdrawableWeiIndexed.ge(event.params.amountWei)) {
      author.withdrawableWeiIndexed = author.withdrawableWeiIndexed.minus(event.params.amountWei);
    } else {
      author.withdrawableWeiIndexed = BigInt.zero();
    }
  }

  author.save();
  w.save();
}
