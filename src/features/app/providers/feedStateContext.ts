import { createContext } from "react";
import type { Post, PostComment } from "@types";

export type FeedContextValue = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;

  isFeedLoading: boolean;
  refreshFeed: (accountOverride?: string | null) => Promise<void>;

  postComments: Record<string, PostComment[]>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
  isLoadingPostComments: Record<string, boolean>;
  loadCommentsForPost: (tokenId: string, postChainId?: string | null) => Promise<void>;

  loadPostsByTokenIds: (tokenIds: string[], postChainId?: string | null) => Promise<void>;
};

// Keep the context stable across HMR updates.
export const FeedContext: ReturnType<typeof createContext<FeedContextValue | null>> =
  ((globalThis as any).__sbnetFeedContext as ReturnType<typeof createContext<FeedContextValue | null>> | undefined) ??
  (((globalThis as any).__sbnetFeedContext = createContext<FeedContextValue | null>(null)) as ReturnType<
    typeof createContext<FeedContextValue | null>
  >);
