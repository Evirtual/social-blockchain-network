import type { Post } from "@types";
import type { PostActionsController } from "@features/post";

export type FeedViewModel = {
  title?: string;
  pillText?: string;
  banner?: React.ReactNode;
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
};
