import { useMemo } from "react";
import type { Post } from "@types";
import { AccountFeedHeaderAction } from "../components/AccountFeedHeaderAction";
import { useAccountFeedView } from "./useAccountFeedView";
import { useFeedFilterViewModel } from "@features/home/hooks/useFeedFilterViewModel";

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
    authorAddress
  });

  const selectedNetworkSet = useMemo(() => new Set(selectedNetworkChainIds.map(String)), [selectedNetworkChainIds]);

  const filterBySelectedNetworks = useMemo(() => {
    return (posts: Post[]) => {
      if (selectedNetworkSet.size === 0) return posts;
      return posts.filter((post) => {
        const id = post.chainId ?? null;
        if (!id) return false;
        return selectedNetworkSet.has(String(id));
      });
    };
  }, [selectedNetworkSet]);

  const postedCount = useMemo(() => filterBySelectedNetworks(args.posts).length, [args.posts, filterBySelectedNetworks]);
  const savedCount = useMemo(
    () => filterBySelectedNetworks(args.savedPosts).length,
    [args.savedPosts, filterBySelectedNetworks]
  );
  const likedCount = useMemo(
    () => filterBySelectedNetworks(args.likedPosts).length,
    [args.likedPosts, filterBySelectedNetworks]
  );

  const headerInlineAction = useMemo(() => {
    return (
      <AccountFeedHeaderAction
        view={view}
        onViewChange={setView}
        postedCount={postedCount}
        savedCount={savedCount}
        likedCount={likedCount}
      />
    );
  }, [view, setView, postedCount, savedCount, likedCount]);

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
