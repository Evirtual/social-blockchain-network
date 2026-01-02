import { createContext } from "react";
import { createStableContext } from "@shared/lib/createStableContext";
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
export const FeedStateContext = createStableContext("__sbnetFeedStateContext", () =>
  createContext<FeedState | null>(null)
);

export const FeedActionsContext = createStableContext("__sbnetFeedActionsContext", () =>
  createContext<FeedActions | null>(null)
);

export const FeedContext = createStableContext("__sbnetFeedContext", () =>
  createContext<FeedContextValue | null>(null)
);
