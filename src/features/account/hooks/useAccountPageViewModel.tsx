import { useEffect, useMemo, useState } from "react";
import type { Post } from "@types";
import { AccountFeedHeaderAction } from "../components/AccountFeedHeaderAction";
import { useAccountFeedView } from "./useAccountFeedView";
import { useFeedFilterViewModel } from "@features/feed";
import { loadAccountCountsFromSubgraphs } from "../services/subgraph/loadAccountCounts";

type Args = {
  posts: Post[];
  savedPosts: Post[];
  likedPosts: Post[];
  isFeedLoading: boolean;
  isLoadingSaved: boolean;
  isLoadingLiked: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  shortAddress: (address: string) => string;
};

export function useAccountPageViewModel(args: Args) {
  const { view, setView, activePosts, activeLoading } = useAccountFeedView({
    posts: args.posts,
    savedPosts: args.savedPosts,
    likedPosts: args.likedPosts,
    isFeedLoading: args.isFeedLoading,
    isLoadingSaved: args.isLoadingSaved,
    isLoadingLiked: args.isLoadingLiked
  });

  const authorAddress = view === "all" ? args.walletAddress : null;
  const useSubgraphSearch = view === "all";

  const {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    filteredPosts,
    pillText,
    isPillLoading
  } = useFeedFilterViewModel({
    posts: activePosts,
    authorIdentity: args.authorIdentity,
    shortAddress: args.shortAddress,
    searchQueryKey: "socialBlockchainNetwork.feed.searchQuery",
    selectedNetworksKey: "socialBlockchainNetwork.feed.selectedNetworks",
    walletAddress: args.walletAddress,
    chainId: args.chainId,
    isFeedLoading: activeLoading,
    useSubgraphSearch,
    authorAddress,
    countMode: view === "all" ? "auto" : "visible"
  });

  const [accountCounts, setAccountCounts] = useState<{ posted: number; saved: number; liked: number } | null>(null);
  const [isAccountCountsLoading, setIsAccountCountsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const walletLower = typeof args.walletAddress === "string" ? args.walletAddress.toLowerCase() : "";
    if (!walletLower) {
      setAccountCounts(null);
      setIsAccountCountsLoading(false);
      return () => {
        active = false;
      };
    }

    const selectedIds = selectedNetworkChainIds.length ? selectedNetworkChainIds : [];
    if (selectedIds.length === 0) {
      setAccountCounts({ posted: 0, saved: 0, liked: 0 });
      setIsAccountCountsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadCounts = async () => {
      if (active) setIsAccountCountsLoading(true);
      try {
        const counts = await loadAccountCountsFromSubgraphs({
          walletAddress: walletLower,
          selectedChainIds: selectedIds
        });
        if (!active) return;
        setAccountCounts(counts);
      } finally {
        if (active) setIsAccountCountsLoading(false);
      }
    };

    void loadCounts();

    return () => {
      active = false;
    };
  }, [args.walletAddress, selectedNetworkChainIds]);

  const headerInlineAction = useMemo(() => {
    const localPosted = args.posts.length;
    const localSaved = args.savedPosts.length;
    const localLiked = args.likedPosts.length;
    const resolvedPosted = Math.max(accountCounts?.posted ?? 0, localPosted);
    const resolvedSaved = Math.max(accountCounts?.saved ?? 0, localSaved);
    const resolvedLiked = Math.max(accountCounts?.liked ?? 0, localLiked);

    // Only show loading skeletons on the active tab.
    // (If we're fetching subgraph counts, all tabs can skeleton since they're all being refreshed.)
    const isPostedLoading = isAccountCountsLoading || (view === "all" && activeLoading);
    const isSavedLoading = isAccountCountsLoading || (view === "saved" && activeLoading);
    const isLikedLoading = isAccountCountsLoading || (view === "liked" && activeLoading);

    return (
      <AccountFeedHeaderAction
        view={view}
        onViewChange={setView}
        postedCount={resolvedPosted}
        savedCount={resolvedSaved}
        likedCount={resolvedLiked}
        isPostedLoading={isPostedLoading}
        isSavedLoading={isSavedLoading}
        isLikedLoading={isLikedLoading}
      />
    );
  }, [view, setView, accountCounts, activeLoading, isAccountCountsLoading, args.posts.length, args.savedPosts.length, args.likedPosts.length]);

  return {
    activeLoading,
    activePosts,
    filteredActivePosts: filteredPosts,
    headerInlineAction,
    pillText,
    isPillLoading,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    supportedNetworks
  };
}
