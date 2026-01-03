import { useMemo, useState } from "react";
import type { Post } from "@types";

export type AccountFeedView = "all" | "saved" | "liked";

export function useAccountFeedView(params: {
  posts: Post[];
  savedPosts: Post[];
  likedPosts: Post[];
  isFeedLoading: boolean;
  isLoadingSaved: boolean;
  isLoadingLiked: boolean;
}) {
  const [view, setView] = useState<AccountFeedView>("all");

  const activePosts = useMemo(() => {
    if (view === "saved") return params.savedPosts.map((p) => ({ ...p, contextTag: "saved" as const }));
    if (view === "liked") return params.likedPosts.map((p) => ({ ...p, contextTag: "liked" as const }));
    return params.posts.map((p) => ({ ...p, contextTag: undefined }));
  }, [view, params.posts, params.savedPosts, params.likedPosts]);

  const rawLoading =
    view === "saved" ? params.isLoadingSaved : view === "liked" ? params.isLoadingLiked : params.isFeedLoading;

  // If we already have items to show, don't keep the whole feed in a loading state.
  // (Saved/Liked scans can continue in the background across multiple networks.)
  const activeLoading = rawLoading && activePosts.length === 0;

  return {
    view,
    setView,
    activePosts,
    activeLoading
  };
}
