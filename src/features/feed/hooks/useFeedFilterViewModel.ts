import { useEffect, useMemo, useState } from "react";
import type { Post } from "@types";
import { useSupportedNetworks } from "./useSupportedNetworks";
import { useNetworkFilterState } from "./useNetworkFilterState";
import { filterPosts } from "../services/filterPosts";
import {
  loadAuthorPostsCountFromSubgraphs,
  loadTotalPostsCountFromSubgraphs
} from "@features/feed/services/subgraph/loadFeedCounts";
import { loadRemoteSearchPostsFromSubgraphs } from "@features/feed/services/subgraph/loadRemoteSearchPosts";

type Args = {
  posts: Post[];
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  shortAddress: (address: string) => string;
  searchQueryKey: string;
  selectedNetworksKey: string;
  walletAddress: string | null;
  chainId: string | null;
  isFeedLoading?: boolean;
  useSubgraphSearch?: boolean;
  fallbackSelectedNetworkChainIds?: string[];
  authorAddress?: string | null;
  countMode?: "auto" | "visible";
};

export function useFeedFilterViewModel(args: Args) {
  const countMode: "auto" | "visible" = args.countMode ?? "auto";
  const enableSubgraphQueries = args.useSubgraphSearch !== false;
  const supportedNetworks = useSupportedNetworks();
  const { searchQuery, setSearchQuery, selectedNetworkChainIds, setSelectedNetworkChainIds, isNetworkFilterActive } =
    useNetworkFilterState({
      searchQueryKey: args.searchQueryKey,
      selectedNetworksKey: args.selectedNetworksKey,
      walletAddress: args.walletAddress,
      chainId: args.chainId,
      supportedNetworks
    });
  const [totalPostsCount, setTotalPostsCount] = useState<number | null>(null);
  const [isTotalPostsLoading, setIsTotalPostsLoading] = useState(false);
  const [authorPostsCount, setAuthorPostsCount] = useState<number | null>(null);
  const [isAuthorPostsLoading, setIsAuthorPostsLoading] = useState(false);
  const [remoteSearchPosts, setRemoteSearchPosts] = useState<Post[] | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  const basePosts = remoteSearchPosts ?? args.posts;
  const authorFilter = typeof args.authorAddress === "string" ? args.authorAddress.trim().toLowerCase() : "";
  const effectiveSelectedNetworkChainIds = useMemo(() => {
    if (selectedNetworkChainIds.length) return selectedNetworkChainIds;
    const fallback = (args.fallbackSelectedNetworkChainIds ?? []).filter((x) => typeof x === "string" && x.trim());
    return fallback.length ? fallback : selectedNetworkChainIds;
  }, [selectedNetworkChainIds, args.fallbackSelectedNetworkChainIds]);
  const scopedPosts = useMemo(() => {
    if (!authorFilter) return basePosts;
    return basePosts.filter((post) => (post.author ?? "").toLowerCase() === authorFilter);
  }, [basePosts, authorFilter]);
  const filteredPosts = useMemo(() => {
    return filterPosts({
      posts: scopedPosts,
      authorIdentity: args.authorIdentity,
      shortAddress: args.shortAddress,
      searchQuery,
      selectedNetworkChainIds: effectiveSelectedNetworkChainIds
    });
  }, [scopedPosts, args.authorIdentity, args.shortAddress, searchQuery, effectiveSelectedNetworkChainIds]);

  useEffect(() => {
    if (countMode !== "auto") {
      setTotalPostsCount(null);
      setIsTotalPostsLoading(false);
      return;
    }

    if (!enableSubgraphQueries) {
      setTotalPostsCount(null);
      setIsTotalPostsLoading(false);
      return;
    }

    let active = true;
    const selectedIds = selectedNetworkChainIds.length
      ? selectedNetworkChainIds
      : supportedNetworks.map((n) => String(n.chainId));

    if (authorFilter) {
      setTotalPostsCount(null);
      setIsTotalPostsLoading(false);
      setAuthorPostsCount(null);
      setIsAuthorPostsLoading(false);
      return () => {
        active = false;
      };
    }

    if (selectedIds.length === 0) {
      setTotalPostsCount(0);
      setIsTotalPostsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadTotals = async () => {
      if (active) setIsTotalPostsLoading(true);
      try {
        const sum = await loadTotalPostsCountFromSubgraphs({ selectedChainIds: selectedIds });
        if (active) setTotalPostsCount(sum);
      } finally {
        if (active) setIsTotalPostsLoading(false);
      }
    };

    void loadTotals();

    return () => {
      active = false;
    };
  }, [countMode, enableSubgraphQueries, supportedNetworks, selectedNetworkChainIds, authorFilter]);

  useEffect(() => {
    if (countMode !== "auto") {
      setAuthorPostsCount(null);
      setIsAuthorPostsLoading(false);
      return;
    }

    if (!enableSubgraphQueries) {
      setAuthorPostsCount(null);
      setIsAuthorPostsLoading(false);
      return;
    }

    let active = true;
    const selectedIds = selectedNetworkChainIds.length
      ? selectedNetworkChainIds
      : supportedNetworks.map((n) => String(n.chainId));

    if (!authorFilter) {
      setAuthorPostsCount(null);
      setIsAuthorPostsLoading(false);
      return () => {
        active = false;
      };
    }

    if (selectedIds.length === 0) {
      setAuthorPostsCount(0);
      setIsAuthorPostsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadAuthorTotals = async () => {
      if (active) setIsAuthorPostsLoading(true);
      try {
        const sum = await loadAuthorPostsCountFromSubgraphs({
          authorAddress: authorFilter,
          selectedChainIds: selectedIds
        });
        if (active) setAuthorPostsCount(sum);
      } finally {
        if (active) setIsAuthorPostsLoading(false);
      }
    };

    void loadAuthorTotals();

    return () => {
      active = false;
    };
  }, [countMode, enableSubgraphQueries, supportedNetworks, selectedNetworkChainIds, authorFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    const trimmedQuery = debouncedSearchQuery.trim();
    const minQueryLength = 3;

    if (!enableSubgraphQueries || !trimmedQuery || trimmedQuery.length < minQueryLength) {
      setRemoteSearchPosts(null);
      return () => {
        active = false;
      };
    }

    const selectedIds = selectedNetworkChainIds.length
      ? selectedNetworkChainIds
      : supportedNetworks.map((n) => String(n.chainId));

    if (selectedIds.length === 0) {
      setRemoteSearchPosts([]);
      return () => {
        active = false;
      };
    }

    const loadSearch = async () => {
      if (!active) return;
      const next = await loadRemoteSearchPostsFromSubgraphs({
        selectedChainIds: selectedIds,
        searchQuery: trimmedQuery,
        walletAddress: args.walletAddress,
        authorFilter
      });
      if (!active) return;
      setRemoteSearchPosts(next);
    };

    void loadSearch();

    return () => {
      active = false;
    };
  }, [
    enableSubgraphQueries,
    debouncedSearchQuery,
    selectedNetworkChainIds,
    supportedNetworks,
    args.walletAddress,
    authorFilter
  ]);

  const trimmedQuery = searchQuery.trim();
  const noNetworksSelected = effectiveSelectedNetworkChainIds.length === 0;
  const visiblePostsCount = filteredPosts.length;
  const isPillLoading =
    countMode === "auto" &&
    !noNetworksSelected &&
    !trimmedQuery &&
    enableSubgraphQueries &&
    (Boolean(args.isFeedLoading) || (authorFilter ? isAuthorPostsLoading : isTotalPostsLoading));
  const pillText = noNetworksSelected
    ? ""
    : isPillLoading
      ? ""
      : trimmedQuery
        ? `${visiblePostsCount} ${visiblePostsCount === 1 ? "post" : "posts"}`
        : countMode === "visible"
          ? `${visiblePostsCount} ${visiblePostsCount === 1 ? "post" : "posts"}`
          : `${authorFilter ? Math.max(authorPostsCount ?? 0, visiblePostsCount) : Math.max(totalPostsCount ?? 0, visiblePostsCount)} posts`;

  return {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    filteredPosts,
    pillText,
    isPillLoading,
    isNetworkFilterActive
  };
}
