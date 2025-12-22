export type Post = {
  tokenId: string;
  title: string;
  body: string;
  image: string;
  metadataURI: string;
  author?: string;
  mintTxHash?: string;
  likes: number;
  comments: number;
  shares: number;
  tipsWei: bigint;
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
};

export type PostComment = {
  commenter: string;
  comment: string;
  txHash?: string;
  blockNumber?: number;
};
