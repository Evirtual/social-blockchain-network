import { Address, BigInt } from "@graphprotocol/graph-ts";

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
    p.searchText = id;
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

function updatePostSearchText(post: Post): void {
  let search = post.tokenId;
  if (post.author !== null) {
    const authorText = post.author!.toHexString();
    if (authorText.length > 0) {
      search = search + " " + authorText;
    }
  }
  if (post.title.length > 0) {
    search = search + " " + post.title;
  }
  if (post.body.length > 0) {
    search = search + " " + post.body;
  }
  post.searchText = search;
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
  p.tokenURI = event.params.tokenURI;
  updatePostSearchText(p);
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
  p.tokenURI = event.params.tokenURI;
  updatePostSearchText(p);
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostUpdatedByAdmin(event: PostUpdatedByAdmin): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp).save();

  p.author = event.params.author;
  p.tokenURI = event.params.tokenURI;
  updatePostSearchText(p);
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
