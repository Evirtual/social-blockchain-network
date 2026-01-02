import { createContext } from "react";
import type { Post, PostComment } from "@types";

export type FeedState = {
  posts: Post[];
  isFeedLoading: boolean;
  postComments: Record<string, PostComment[]>;
  isLoadingPostComments: Record<string, boolean>;
};

export type FeedActions = {
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  refreshFeed: (accountOverride?: string | null) => Promise<void>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
  loadCommentsForPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
  loadPostsByTokenIds: (tokenIds: string[], postChainId?: string | null) => Promise<void>;
};

export type FeedContextValue = FeedState & FeedActions;

// Keep the contexts stable across HMR updates.
export const FeedStateContext: ReturnType<typeof createContext<FeedState | null>> =
  (globalThis as { __sbnetFeedStateContext?: ReturnType<typeof createContext<FeedState | null>> }).__sbnetFeedStateContext ??
  (((globalThis as { __sbnetFeedStateContext?: ReturnType<typeof createContext<FeedState | null>> }).__sbnetFeedStateContext =
    createContext<FeedState | null>(null)) as ReturnType<typeof createContext<FeedState | null>>);

export const FeedActionsContext: ReturnType<typeof createContext<FeedActions | null>> =
  (globalThis as { __sbnetFeedActionsContext?: ReturnType<typeof createContext<FeedActions | null>> }).__sbnetFeedActionsContext ??
  (((globalThis as { __sbnetFeedActionsContext?: ReturnType<typeof createContext<FeedActions | null>> }).__sbnetFeedActionsContext =
    createContext<FeedActions | null>(null)) as ReturnType<typeof createContext<FeedActions | null>>);

export const FeedContext: ReturnType<typeof createContext<FeedContextValue | null>> =
  (globalThis as { __sbnetFeedContext?: ReturnType<typeof createContext<FeedContextValue | null>> }).__sbnetFeedContext ??
  (((globalThis as { __sbnetFeedContext?: ReturnType<typeof createContext<FeedContextValue | null>> }).__sbnetFeedContext =
    createContext<FeedContextValue | null>(null)) as ReturnType<typeof createContext<FeedContextValue | null>>);
