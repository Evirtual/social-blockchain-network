import { useMemo } from "react";
import type { Post } from "@types";
import { useSupportedNetworks } from "./useSupportedNetworks";
import { useNetworkFilterState } from "./useNetworkFilterState";
import { filterPosts } from "../services/filterPosts";

type Args = {
  posts: Post[];
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  shortAddress: (address: string) => string;
  searchQueryKey: string;
  selectedNetworksKey: string;
  walletAddress: string | null;
  chainId: string | null;
};

export function useFeedFilterViewModel(args: Args) {
  const supportedNetworks = useSupportedNetworks();
  const { searchQuery, setSearchQuery, selectedNetworkChainIds, setSelectedNetworkChainIds, isNetworkFilterActive } =
    useNetworkFilterState({
      searchQueryKey: args.searchQueryKey,
      selectedNetworksKey: args.selectedNetworksKey,
      walletAddress: args.walletAddress,
      chainId: args.chainId,
      supportedNetworks
    });

  const filteredPosts = useMemo(() => {
    return filterPosts({
      posts: args.posts,
      authorIdentity: args.authorIdentity,
      shortAddress: args.shortAddress,
      searchQuery,
      selectedNetworkChainIds
    });
  }, [args.posts, args.authorIdentity, args.shortAddress, searchQuery, selectedNetworkChainIds]);

  const hasAnyFilter = !!searchQuery.trim() || isNetworkFilterActive;
  const pillText = hasAnyFilter ? `${filteredPosts.length} / ${args.posts.length} posts` : `${args.posts.length} posts`;

  return {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    filteredPosts,
    pillText,
    isNetworkFilterActive
  };
}
