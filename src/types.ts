export type Post = {
  tokenId: string;
  chainId?: string;
  title: string;
  body: string;
  image: string;
  animationUrl?: string;
  metadataURI: string;
  author?: string;
  mintTxHash?: string;
  mintBlockNumber?: number;
  mintTimestamp?: number;
  likes: number;
  comments: number;
  saves: number;
  tipsWei: bigint;
  likedByMe?: boolean;
  savedByMe?: boolean;
  contextTag?: "saved" | "liked";
};

export type TxState = "signing" | "pending" | "confirmed" | "failed" | "cancelled";

export type TxNotice = {
  hash: string;
  label: string;
  state: TxState;
  createdAt: number;
  explorerUrl: string | null;
  error?: string;
};

export type TrimInfo = {
  startMs: number;
  endMs: number;
  durationMs: number;
};

export type Draft = {
  title: string;
  body: string;
  imageUrl: string;
  imageDataUrl: string;
  videoTrim?: TrimInfo;
  videoPosterUrl?: string;
};

export type TokenMetadata = {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
};

export type PostComment = {
  commentId: string;
  tokenId: string;
  author: string;
  parentId?: string | null;
  comment: string;
  deleted?: boolean;
  edited?: boolean;
  likeCount?: number;
  saveCount?: number;
  tipWei?: bigint;
  likedByMe?: boolean;
  savedByMe?: boolean;
  txHash?: string;
  blockNumber?: number;
  logIndex?: number;
};
