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
  Withdrawal
} from "../generated/schema";

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

    a.withdrawableWeiIndexed = BigInt.zero();

    a.updatedAtBlock = null;
    a.updatedAtTimestamp = null;
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

  getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp).save();

  p.author = event.params.author;
  p.tokenURI = event.params.tokenURI;
  p.mintTxHash = event.transaction.hash;
  p.mintBlockNumber = event.block.number;
  p.mintTimestamp = event.block.timestamp;
  p.burnedAtBlock = null;
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostUpdated(event: PostUpdated): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp).save();

  p.author = event.params.author;
  p.tokenURI = event.params.tokenURI;
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostUpdatedByAdmin(event: PostUpdatedByAdmin): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  getOrCreateAccount(event.params.author, event.block.number, event.block.timestamp).save();

  p.author = event.params.author;
  p.tokenURI = event.params.tokenURI;
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

  p.burnedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

  p.save();
}

export function handlePostBurnedByAdmin(event: PostBurnedByAdmin): void {
  const tokenId = event.params.tokenId;
  const p = getOrCreatePost(tokenId);

  p.burnedAtBlock = event.block.number;
  p.updatedAtBlock = event.block.number;

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
