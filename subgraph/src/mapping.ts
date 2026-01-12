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
  PostEditedStatus,
  PostTipped,
  PosterAllowed,
  PosterAllowedBy,
  PosterApprovalRequested,
  PosterApprovalRequestedTo,
  ProfileClearedByAdmin,
  ProfileModerated,
  ProfileUpdated,
  TipsWithdrawn,
  Unfollowed,
  CommentAdded,
  CommentEdited,
  CommentDeleted,
  CommentLiked,
  CommentUnliked,
  CommentSaved,
  CommentUnsaved,
  CommentTipped,
  PostReported,
  CommentReported,
  ModeratorSet,
  OwnershipTransferred
} from "../generated/SocialPosts/SocialPosts";

import {
  Account,
  Comment,
  CommentLikeEdge,
  CommentSaveEdge,
  CommentTip,
  CommentReport,
  FollowEdge,
  LikeEdge,
  Notification,
  Post,
  PostReport,
  SaveEdge,
  Tip,
  Withdrawal,
  GlobalStats,
  ProtocolConfig
} from "../generated/schema";

const GLOBAL_STATS_ID = "global";
const PROTOCOL_CONFIG_ID = "protocol";
const DATA_URI_PREFIX = "data:application/json;base64,";
const ACCOUNT_LEVEL_TOKEN_ID = "0";

function getOrCreateProtocolConfig(): ProtocolConfig {
  let c = ProtocolConfig.load(PROTOCOL_CONFIG_ID);
  if (c == null) {
    c = new ProtocolConfig(PROTOCOL_CONFIG_ID);
    c.admin = Address.zero();
    c.moderators = [];
  }
  return c as ProtocolConfig;
}

function addModerator(config: ProtocolConfig, account: Address): void {
  const list = config.moderators;
  for (let i = 0; i < list.length; i++) {
    if (list[i].equals(account)) return;
  }
  list.push(account);
  config.moderators = list;
}

function removeModerator(config: ProtocolConfig, account: Address): void {
  const list = config.moderators;
  const next: Bytes[] = [];
  for (let i = 0; i < list.length; i++) {
    if (!list[i].equals(account)) next.push(list[i]);
  }
  config.moderators = next;
}

function createModerationNotification(
  kind: string,
  recipientAddress: Address,
  actorAddress: Address,
  tokenId: string,
  commentId: string | null,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  if (recipientAddress.equals(Address.zero())) return;
  if (actorAddress.equals(Address.zero())) return;
  if (recipientAddress.equals(actorAddress)) return;

  const recipient = getOrCreateAccount(recipientAddress, blockNumber, timestamp);
  const actor = getOrCreateAccount(actorAddress, blockNumber, timestamp);

  // Multiple recipients can be notified from the same log; include recipient in the ID.
  const id = getLogId(txHash.toHexString(), logIndex) + "-" + recipientAddress.toHexString();
  const n = new Notification(id);
  n.kind = kind;
  n.recipient = recipient.id;
  n.actor = actor.id;
  n.tokenId = tokenId;
  n.commentId = commentId;
  n.amountWei = null;
  n.txHash = txHash;
  n.logIndex = logIndex;
  n.blockNumber = blockNumber;
  n.timestamp = timestamp;
  n.save();

  recipient.save();
  actor.save();
}

function createPostScopedNotification(
  kind: string,
  recipientAddress: Address,
  actorAddress: Address,
  tokenId: string,
  commentId: string | null,
  amountWei: BigInt | null,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  if (recipientAddress.equals(Address.zero())) return;
  if (actorAddress.equals(Address.zero())) return;
  if (recipientAddress.equals(actorAddress)) return;

  const recipient = getOrCreateAccount(recipientAddress, blockNumber, timestamp);
  const actor = getOrCreateAccount(actorAddress, blockNumber, timestamp);

  const id = getLogId(txHash.toHexString(), logIndex);
  const n = new Notification(id);
  n.kind = kind;
  n.recipient = recipient.id;
  n.actor = actor.id;
  n.tokenId = tokenId;
  n.commentId = commentId;
  n.amountWei = amountWei;
  n.txHash = txHash;
  n.logIndex = logIndex;
  n.blockNumber = blockNumber;
  n.timestamp = timestamp;
  n.save();

  recipient.save();
  actor.save();
}

function notifyModeratorsAndAdmin(
  kind: string,
  reporter: Address,
  tokenId: string,
  commentId: string | null,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  const config = getOrCreateProtocolConfig();

  const admin = Address.fromBytes(config.admin);
  if (!admin.equals(Address.zero())) {
    createModerationNotification(
      kind,
      admin,
      reporter,
      tokenId,
      commentId,
      txHash,
      logIndex,
      blockNumber,
      timestamp
    );
  }

  const moderators = config.moderators;
  for (let i = 0; i < moderators.length; i++) {
    const mod = Address.fromBytes(moderators[i]);
    if (mod.equals(Address.zero())) continue;
    if (mod.equals(admin)) continue;

    createModerationNotification(
      kind,
      mod,
      reporter,
      tokenId,
      commentId,
      txHash,
      logIndex,
      blockNumber,
      timestamp
    );
  }
}

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
    s.totalCommentLikes = BigInt.zero();
    s.totalCommentSaves = BigInt.zero();
    s.totalCommentTipsWei = BigInt.zero();
    s.totalPostReports = BigInt.zero();
    s.totalCommentReports = BigInt.zero();
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
    a.commentLikesCount = BigInt.zero();
    a.commentSavesCount = BigInt.zero();

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
    p.edited = false;
    p.editedAtBlock = null;
    p.burnedAtBlock = null;
    p.updatedAtBlock = null;
    p.author = Address.zero();
    p.mintTxHash = null;
  }
  return p as Post;
}

function getEdgeId(tokenId: BigInt, account: Address): string {
  return tokenId.toString() + "-" + account.toHexString();
}

function getCommentEdgeId(commentId: BigInt, account: Address): string {
  return commentId.toString() + "-" + account.toHexString();
}

function getFollowEdgeId(follower: Address, followee: Address): string {
  return follower.toHexString() + "-" + followee.toHexString();
}

function getLogId(txHashHex: string, logIndex: BigInt): string {
  return txHashHex + "-" + logIndex.toString();
}

function createAccountNotification(
  kind: string,
  recipientAddress: Address,
  actorAddress: Address,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  if (recipientAddress.equals(Address.zero())) return;
  if (actorAddress.equals(Address.zero())) return;
  if (recipientAddress.equals(actorAddress)) return;

  const recipient = getOrCreateAccount(recipientAddress, blockNumber, timestamp);
  const actor = getOrCreateAccount(actorAddress, blockNumber, timestamp);

  const id = getLogId(txHash.toHexString(), logIndex);
  const n = new Notification(id);
  n.kind = kind;
  n.recipient = recipient.id;
  n.actor = actor.id;
  n.tokenId = ACCOUNT_LEVEL_TOKEN_ID;
  n.commentId = null;
  n.amountWei = null;
  n.txHash = txHash;
  n.logIndex = logIndex;
  n.blockNumber = blockNumber;
  n.timestamp = timestamp;
  n.save();

  recipient.save();
  actor.save();
}

function maybeCreatePostNotification(
  kind: string,
  post: Post,
  actorAddress: Address,
  tokenId: BigInt,
  commentId: string,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  const recipientBytes = post.author;
  if (recipientBytes.equals(Address.zero())) return;
  if (recipientBytes.equals(actorAddress)) return;

  const recipient = getOrCreateAccount(Address.fromBytes(recipientBytes), blockNumber, timestamp);
  const actor = getOrCreateAccount(actorAddress, blockNumber, timestamp);

  const id = getLogId(txHash.toHexString(), logIndex);
  const n = new Notification(id);
  n.kind = kind;
  n.recipient = recipient.id;
  n.actor = actor.id;
  n.tokenId = tokenId.toString();
  if (commentId.length > 0) {
    n.commentId = commentId;
  } else {
    n.commentId = null;
  }
  n.amountWei = null;
  n.txHash = txHash;
  n.logIndex = logIndex;
  n.blockNumber = blockNumber;
  n.timestamp = timestamp;
  n.save();

  recipient.save();
  actor.save();
}

function maybeCreateCommentNotification(
  kind: string,
  recipientId: string,
  actorAddress: Address,
  tokenId: BigInt,
  commentId: BigInt,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  const actorId = actorAddress.toHexString();
  if (recipientId.length == 0) return;
  if (recipientId == actorId) return;
  if (recipientId == Address.zero().toHexString()) return;

  const recipient = getOrCreateAccount(Address.fromString(recipientId), blockNumber, timestamp);
  const actor = getOrCreateAccount(actorAddress, blockNumber, timestamp);

  const id = getLogId(txHash.toHexString(), logIndex);
  const n = new Notification(id);
  n.kind = kind;
  n.recipient = recipient.id;
  n.actor = actor.id;
  n.tokenId = tokenId.toString();
  n.commentId = commentId.toString();
  n.amountWei = null;
  n.txHash = txHash;
  n.logIndex = logIndex;
  n.blockNumber = blockNumber;
  n.timestamp = timestamp;
  n.save();

  recipient.save();
  actor.save();
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

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  const config = getOrCreateProtocolConfig();
  config.admin = event.params.newOwner;
  config.save();
}

export function handleModeratorSet(event: ModeratorSet): void {
  const config = getOrCreateProtocolConfig();

  if (event.params.enabled) {
    addModerator(config, event.params.account);
  } else {
    removeModerator(config, event.params.account);
  }

  config.save();
}

export function handlePosterAllowedBy(event: PosterAllowedBy): void {
  // Notifications for the affected account. Do not show who approved; treat it as self-notification.
  if (event.params.allowed) {
    createAccountNotification(
      "POSTER_APPROVED",
      event.params.account,
      event.params.actor,
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );
    return;
  }

  createAccountNotification(
    "POSTER_DISAPPROVED",
    event.params.account,
    event.params.actor,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
}

export function handlePosterApprovalRequested(event: PosterApprovalRequested): void {
  const a = getOrCreateAccount(event.params.account, event.block.number, event.block.timestamp);
  a.posterRequested = true;
  a.save();
}

export function handlePosterApprovalRequestedTo(event: PosterApprovalRequestedTo): void {
  createAccountNotification(
    "POSTER_APPROVAL_REQUESTED",
    event.params.recipient,
    event.params.account,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
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

  createAccountNotification(
    "PROFILE_MODERATED",
    event.params.account,
    event.params.admin,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
}

export function handleProfileClearedByAdmin(event: ProfileClearedByAdmin): void {
  const a = getOrCreateAccount(event.params.account, event.block.number, event.block.timestamp);
  a.name = null;
  a.bio = null;
  a.avatar = null;
  a.save();

  createAccountNotification(
    "PROFILE_CLEARED_BY_ADMIN",
    event.params.account,
    event.params.admin,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
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

  createAccountNotification(
    "FOLLOWED",
    event.params.followee,
    event.params.follower,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
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

  createAccountNotification(
    "UNFOLLOWED",
    event.params.followee,
    event.params.follower,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
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
  p.edited = false;
  p.editedAtBlock = null;
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

  maybeCreatePostNotification(
    "POST_UPDATED_BY_ADMIN",
    p,
    event.params.admin,
    tokenId,
    "",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
}

export function handlePostEditedStatus(event: PostEditedStatus): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  p.edited = event.params.edited;
  p.editedAtBlock = event.params.edited ? event.block.number : null;
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostFrozen(event: PostFrozen): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  if (p.author.equals(Address.zero())) {
    p.author = event.params.author;
  }

  p.frozenAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  p.save();

  maybeCreatePostNotification(
    "POST_FROZEN",
    p,
    event.transaction.from,
    tokenId,
    "",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
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

  if (p.author.equals(Address.zero())) {
    p.author = event.params.author;
  }

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

  maybeCreatePostNotification(
    "POST_REMOVED_BY_ADMIN",
    p,
    event.params.admin,
    tokenId,
    "",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
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

    maybeCreatePostNotification(
      "POST_LIKED",
      p,
      event.params.liker,
      tokenId,
      "",
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );
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

    maybeCreatePostNotification(
      "POST_SAVED",
      p,
      event.params.saver,
      tokenId,
      "",
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );
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

export function handleCommentAdded(event: CommentAdded): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  const author = getOrCreateAccount(event.params.commenter, event.block.number, event.block.timestamp);
  const commentId = event.params.commentId.toString();
  let c = Comment.load(commentId);
  if (c == null) {
    c = new Comment(commentId);
    c.commentId = commentId;
    c.tokenId = tokenId.toString();
    c.author = author.id;
    c.parentId = event.params.parentId.isZero() ? null : event.params.parentId.toString();
    c.comment = event.params.comment;
    c.deleted = false;
    c.edited = false;
    c.likeCount = BigInt.zero();
    c.saveCount = BigInt.zero();
    c.tipWei = BigInt.zero();
    c.createdTxHash = event.transaction.hash;
    c.createdAtBlock = event.block.number;
    c.createdAtTimestamp = event.block.timestamp;
    c.updatedAtBlock = event.block.number;
    c.updatedAtTimestamp = event.block.timestamp;

    p.comments = p.comments.plus(BigInt.fromI32(1));
    author.commentsCount = author.commentsCount.plus(BigInt.fromI32(1));
    const stats = getOrCreateGlobalStats();
    stats.totalComments = stats.totalComments.plus(BigInt.fromI32(1));
    stats.save();

    maybeCreatePostNotification(
      "POST_COMMENTED",
      p,
      event.params.commenter,
      tokenId,
      commentId,
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );

    if (c.parentId != null) {
      const parent = Comment.load(c.parentId as string);
      if (parent != null) {
        maybeCreateCommentNotification(
          "COMMENT_REPLIED",
          parent.author,
          event.params.commenter,
          tokenId,
          event.params.commentId,
          event.transaction.hash,
          event.logIndex,
          event.block.number,
          event.block.timestamp
        );
      }
    }
  }

  p.updatedAtBlock = event.block.number;

  author.save();
  c.save();
  p.save();
}

export function handleCommentEdited(event: CommentEdited): void {
  const commentId = event.params.commentId.toString();
  let c = Comment.load(commentId);
  if (c == null) return;

  c.comment = event.params.comment;
  c.edited = true;
  c.updatedAtBlock = event.block.number;
  c.updatedAtTimestamp = event.block.timestamp;
  c.save();

  const p = getOrCreatePost(event.params.tokenId);
  p.updatedAtBlock = event.block.number;
  p.save();
}

export function handleCommentDeleted(event: CommentDeleted): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);
  const commentId = event.params.commentId.toString();
  let c = Comment.load(commentId);
  if (c == null) return;

  maybeCreateCommentNotification(
    "COMMENT_REMOVED",
    c.author,
    event.params.deleter,
    tokenId,
    event.params.commentId,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );

  if (!c.deleted) {
    c.deleted = true;
    c.comment = "";
    if (p.comments.gt(BigInt.zero())) {
      p.comments = p.comments.minus(BigInt.fromI32(1));
    }

    const author = Account.load(c.author);
    if (author != null && author.commentsCount.gt(BigInt.zero())) {
      author.commentsCount = author.commentsCount.minus(BigInt.fromI32(1));
      author.save();
    }

    const stats = getOrCreateGlobalStats();
    if (stats.totalComments.gt(BigInt.zero())) {
      stats.totalComments = stats.totalComments.minus(BigInt.fromI32(1));
    }
    stats.save();
  }

  c.updatedAtBlock = event.block.number;
  c.updatedAtTimestamp = event.block.timestamp;
  p.updatedAtBlock = event.block.number;

  c.save();
  p.save();
}

export function handleCommentLiked(event: CommentLiked): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);
  const commentId = event.params.commentId;

  const a = getOrCreateAccount(event.params.liker, event.block.number, event.block.timestamp);
  const edgeId = getCommentEdgeId(commentId, event.params.liker);
  let edge = CommentLikeEdge.load(edgeId);
  if (edge == null) {
    edge = new CommentLikeEdge(edgeId);
    edge.commentId = commentId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  const c = Comment.load(commentId.toString());
  if (c != null && !edge.active) {
    edge.active = true;
    c.likeCount = c.likeCount.plus(BigInt.fromI32(1));
    a.commentLikesCount = a.commentLikesCount.plus(BigInt.fromI32(1));
    const stats = getOrCreateGlobalStats();
    stats.totalCommentLikes = stats.totalCommentLikes.plus(BigInt.fromI32(1));
    stats.save();

    maybeCreateCommentNotification(
      "COMMENT_LIKED",
      c.author,
      event.params.liker,
      tokenId,
      commentId,
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );
    c.save();
  }

  edge.updatedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handleCommentUnliked(event: CommentUnliked): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);
  const commentId = event.params.commentId;

  const a = getOrCreateAccount(event.params.unliker, event.block.number, event.block.timestamp);
  const edgeId = getCommentEdgeId(commentId, event.params.unliker);
  let edge = CommentLikeEdge.load(edgeId);
  if (edge == null) {
    edge = new CommentLikeEdge(edgeId);
    edge.commentId = commentId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  const c = Comment.load(commentId.toString());
  if (c != null && edge.active) {
    edge.active = false;
    if (c.likeCount.gt(BigInt.zero())) {
      c.likeCount = c.likeCount.minus(BigInt.fromI32(1));
    }
    if (a.commentLikesCount.gt(BigInt.zero())) {
      a.commentLikesCount = a.commentLikesCount.minus(BigInt.fromI32(1));
    }
    const stats = getOrCreateGlobalStats();
    if (stats.totalCommentLikes.gt(BigInt.zero())) {
      stats.totalCommentLikes = stats.totalCommentLikes.minus(BigInt.fromI32(1));
    }
    stats.save();
    c.save();
  }

  edge.updatedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handleCommentSaved(event: CommentSaved): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);
  const commentId = event.params.commentId;

  const a = getOrCreateAccount(event.params.saver, event.block.number, event.block.timestamp);
  const edgeId = getCommentEdgeId(commentId, event.params.saver);
  let edge = CommentSaveEdge.load(edgeId);
  if (edge == null) {
    edge = new CommentSaveEdge(edgeId);
    edge.commentId = commentId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  const c = Comment.load(commentId.toString());
  if (c != null && !edge.active) {
    edge.active = true;
    c.saveCount = c.saveCount.plus(BigInt.fromI32(1));
    a.commentSavesCount = a.commentSavesCount.plus(BigInt.fromI32(1));
    const stats = getOrCreateGlobalStats();
    stats.totalCommentSaves = stats.totalCommentSaves.plus(BigInt.fromI32(1));
    stats.save();

    maybeCreateCommentNotification(
      "COMMENT_SAVED",
      c.author,
      event.params.saver,
      tokenId,
      commentId,
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );
    c.save();
  }

  edge.updatedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handleCommentUnsaved(event: CommentUnsaved): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);
  const commentId = event.params.commentId;

  const a = getOrCreateAccount(event.params.unsaver, event.block.number, event.block.timestamp);
  const edgeId = getCommentEdgeId(commentId, event.params.unsaver);
  let edge = CommentSaveEdge.load(edgeId);
  if (edge == null) {
    edge = new CommentSaveEdge(edgeId);
    edge.commentId = commentId.toString();
    edge.account = a.id;
    edge.active = false;
    edge.createdAtBlock = event.block.number;
    edge.updatedAtBlock = event.block.number;
  }

  const c = Comment.load(commentId.toString());
  if (c != null && edge.active) {
    edge.active = false;
    if (c.saveCount.gt(BigInt.zero())) {
      c.saveCount = c.saveCount.minus(BigInt.fromI32(1));
    }
    if (a.commentSavesCount.gt(BigInt.zero())) {
      a.commentSavesCount = a.commentSavesCount.minus(BigInt.fromI32(1));
    }
    const stats = getOrCreateGlobalStats();
    if (stats.totalCommentSaves.gt(BigInt.zero())) {
      stats.totalCommentSaves = stats.totalCommentSaves.minus(BigInt.fromI32(1));
    }
    stats.save();
    c.save();
  }

  edge.updatedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  a.save();
  edge.save();
  p.save();
}

export function handleCommentTipped(event: CommentTipped): void {
  const tokenId = event.params.tokenId;
  const commentId = event.params.commentId;
  const p = getOrCreatePost(tokenId);

  const tipper = getOrCreateAccount(event.params.tipper, event.block.number, event.block.timestamp);
  const author = getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp);

  const tipId = getLogId(event.transaction.hash.toHexString(), event.logIndex);
  let t = CommentTip.load(tipId);
  if (t == null) {
    t = new CommentTip(tipId);
    t.tokenId = tokenId.toString();
    t.commentId = commentId.toString();
    t.tipper = tipper.id;
    t.author = author.id;
    t.amountWei = event.params.amountWei;
    t.txHash = event.transaction.hash;
    t.blockNumber = event.block.number;
    t.timestamp = event.block.timestamp;

    const c = Comment.load(commentId.toString());
    if (c != null) {
      c.tipWei = c.tipWei.plus(event.params.amountWei);
      c.save();
    }

    author.withdrawableWeiIndexed = author.withdrawableWeiIndexed.plus(event.params.amountWei);
    const stats = getOrCreateGlobalStats();
    stats.totalCommentTipsWei = stats.totalCommentTipsWei.plus(event.params.amountWei);
    stats.save();

    createPostScopedNotification(
      "COMMENT_TIPPED",
      event.params.author,
      event.params.tipper,
      tokenId.toString(),
      commentId.toString(),
      event.params.amountWei,
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );
  }

  p.updatedAtBlock = event.block.number;

  tipper.save();
  author.save();
  t.save();
  p.save();
}

export function handlePostReported(event: PostReported): void {
  const tokenId = event.params.tokenId;
  getOrCreatePost(tokenId);
  const reporter = getOrCreateAccount(event.params.reporter, event.block.number, event.block.timestamp);

  const reportId = getLogId(event.transaction.hash.toHexString(), event.logIndex);
  let r = PostReport.load(reportId);
  if (r == null) {
    r = new PostReport(reportId);
    r.tokenId = tokenId.toString();
    r.reporter = reporter.id;
    r.reason = event.params.reason;
    r.txHash = event.transaction.hash;
    r.blockNumber = event.block.number;
    r.timestamp = event.block.timestamp;

    const stats = getOrCreateGlobalStats();
    stats.totalPostReports = stats.totalPostReports.plus(BigInt.fromI32(1));
    stats.save();
  }

  reporter.save();
  r.save();

  notifyModeratorsAndAdmin(
    "POST_REPORTED",
    event.params.reporter,
    tokenId.toString(),
    null,
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
}

export function handleCommentReported(event: CommentReported): void {
  const tokenId = event.params.tokenId;
  const commentId = event.params.commentId;
  getOrCreatePost(tokenId);
  const reporter = getOrCreateAccount(event.params.reporter, event.block.number, event.block.timestamp);

  const reportId = getLogId(event.transaction.hash.toHexString(), event.logIndex);
  let r = CommentReport.load(reportId);
  if (r == null) {
    r = new CommentReport(reportId);
    r.tokenId = tokenId.toString();
    r.commentId = commentId.toString();
    r.reporter = reporter.id;
    r.reason = event.params.reason;
    r.txHash = event.transaction.hash;
    r.blockNumber = event.block.number;
    r.timestamp = event.block.timestamp;

    const stats = getOrCreateGlobalStats();
    stats.totalCommentReports = stats.totalCommentReports.plus(BigInt.fromI32(1));
    stats.save();
  }

  reporter.save();
  r.save();

  notifyModeratorsAndAdmin(
    "COMMENT_REPORTED",
    event.params.reporter,
    tokenId.toString(),
    commentId.toString(),
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp
  );
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

    createPostScopedNotification(
      "POST_TIPPED",
      event.params.author,
      event.params.tipper,
      tokenId.toString(),
      null,
      event.params.amountWei,
      event.transaction.hash,
      event.logIndex,
      event.block.number,
      event.block.timestamp
    );
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
