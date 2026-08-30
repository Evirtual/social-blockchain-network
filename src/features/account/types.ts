import type { Post } from "@types";
import type { ProfileCardProps, WalletCardProps } from "@features/app";
import type { PostActionsController } from "@features/post";

export type AccountPageViewModel = {
  isOwner: boolean;
  sidebar: ProfileCardProps & WalletCardProps;
  status: string;
  isFeedLoading: boolean;
  posts: Post[];
  savedPosts: Post[];
  likedPosts: Post[];
  isLoadingSaved: boolean;
  isLoadingLiked: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  postActions: PostActionsController;
};
