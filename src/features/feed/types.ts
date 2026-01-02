import type { Post } from "@types";
import type { PostActionsController } from "@features/post";

export type FeedViewModel = {
  title?: string;
  pillText?: string;
  headerInlineAction?: React.ReactNode;
  headerAction?: React.ReactNode;
  headerActionPlacement?: "right" | "inline";
  singleColumn?: boolean;
  hideHeader?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  posts: Post[];
  isOwner?: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  postActions: PostActionsController;
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};
