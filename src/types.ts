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
  shares: number;
  tipsWei: bigint;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  contextTag?: "saved";
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

export type Draft = {
  title: string;
  body: string;
  imageUrl: string;
  imageDataUrl: string;
};

export type TokenMetadata = {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
};

export type PostComment = {
  commenter: string;
  comment: string;
  txHash?: string;
  blockNumber?: number;
};
