import { useCallback, useEffect, useMemo, useState } from "react";
import type { Post } from "@types";
import { useSupportedNetworks } from "./useSupportedNetworks";
import { useNetworkFilterState } from "./useNetworkFilterState";
import { filterPosts } from "../services/filterPosts";
import {
  loadAuthorPostsCountFromSubgraphs,
  loadTotalPostsCountFromSubgraphs
} from "@features/feed/services/subgraph/loadFeedCounts";
import { loadRemoteSearchPostsFromSubgraphs } from "@features/feed/services/subgraph/loadRemoteSearchPosts";
import {
  AUTHOR_COUNT_CACHE,
  REMOTE_SEARCH_CACHE,
  TOTAL_COUNT_CACHE,
  buildAuthorCountCacheKey,
  buildRemoteSearchCacheKey,
  buildTotalCountCacheKey,
  setCacheWithCap
} from "@features/feed/services/subgraph/subgraphCache";
import { useSessionStorageState } from "@shared/hooks/useSessionStorageState";

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
  postFilter?: ((post: Post) => boolean) | null;
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

  const [appliedSearchQuery, setAppliedSearchQuery] = useSessionStorageState<string>(
    `${args.searchQueryKey}.applied`,
    "",
    {
      serialize: (v) => String(v ?? ""),
      parse: (raw) => String(raw ?? "")
    }
  );

  const submitSearch = useCallback(() => {
    setAppliedSearchQuery(searchQuery);
  }, [searchQuery, setAppliedSearchQuery]);

  const isSearchDirty = useMemo(() => {
    const draft = (searchQuery ?? "").trim();
    const applied = (appliedSearchQuery ?? "").trim();
    return draft !== applied;
  }, [searchQuery, appliedSearchQuery]);

  const restoreDraftToApplied = useCallback(() => {
    setSearchQuery(appliedSearchQuery);
  }, [setSearchQuery, appliedSearchQuery]);

  const [totalPostsCount, setTotalPostsCount] = useState<number | null>(null);
  const [isTotalPostsLoading, setIsTotalPostsLoading] = useState(false);
  const [authorPostsCount, setAuthorPostsCount] = useState<number | null>(null);
  const [isAuthorPostsLoading, setIsAuthorPostsLoading] = useState(false);
  const [remoteSearchPosts, setRemoteSearchPosts] = useState<Post[] | null>(null);
  const [isRemoteSearchLoading, setIsRemoteSearchLoading] = useState(false);

  const basePosts = remoteSearchPosts ?? args.posts;
  const authorFilter = typeof args.authorAddress === "string" ? args.authorAddress.trim().toLowerCase() : "";
  const effectiveSelectedNetworkChainIds = useMemo(() => {
    if (selectedNetworkChainIds.length) return selectedNetworkChainIds;
    const fallback = (args.fallbackSelectedNetworkChainIds ?? []).filter((x) => typeof x === "string" && x.trim());
    return fallback.length ? fallback : selectedNetworkChainIds;
  }, [selectedNetworkChainIds, args.fallbackSelectedNetworkChainIds]);
  const scopedPosts = useMemo(() => {
    const filteredByAuthor = authorFilter
      ? basePosts.filter((post) => (post.author ?? "").toLowerCase() === authorFilter)
      : basePosts;

    const postFilter = args.postFilter;
    if (!postFilter) return filteredByAuthor;
    return filteredByAuthor.filter(postFilter);
  }, [basePosts, authorFilter, args.postFilter]);
  const filteredPosts = useMemo(() => {
    return filterPosts({
      posts: scopedPosts,
      authorIdentity: args.authorIdentity,
      shortAddress: args.shortAddress,
      searchQuery: appliedSearchQuery,
      selectedNetworkChainIds: effectiveSelectedNetworkChainIds
    });
  }, [scopedPosts, args.authorIdentity, args.shortAddress, appliedSearchQuery, effectiveSelectedNetworkChainIds]);

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

    const cacheKey = buildTotalCountCacheKey(selectedIds);
    const cached = TOTAL_COUNT_CACHE.get(cacheKey);
    if (typeof cached === "number") {
      setTotalPostsCount(cached);
      setIsTotalPostsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadTotals = async () => {
      if (active) setIsTotalPostsLoading(true);
      try {
        const sum = await loadTotalPostsCountFromSubgraphs({ selectedChainIds: selectedIds });
        setCacheWithCap(TOTAL_COUNT_CACHE, cacheKey, sum);
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

    const cacheKey = buildAuthorCountCacheKey({ authorAddress: authorFilter, selectedChainIds: selectedIds });
    const cached = AUTHOR_COUNT_CACHE.get(cacheKey);
    if (typeof cached === "number") {
      setAuthorPostsCount(cached);
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
        setCacheWithCap(AUTHOR_COUNT_CACHE, cacheKey, sum);
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
    let active = true;
    const trimmedQuery = appliedSearchQuery.trim();
    const minQueryLength = 3;

    if (!enableSubgraphQueries || !trimmedQuery || trimmedQuery.length < minQueryLength) {
      setRemoteSearchPosts(null);
      setIsRemoteSearchLoading(false);
      return () => {
        active = false;
      };
    }

    const selectedIds = selectedNetworkChainIds.length
      ? selectedNetworkChainIds
      : supportedNetworks.map((n) => String(n.chainId));

    if (selectedIds.length === 0) {
      setRemoteSearchPosts([]);
      setIsRemoteSearchLoading(false);
      return () => {
        active = false;
      };
    }

    const cacheKey = buildRemoteSearchCacheKey({
      searchQuery: trimmedQuery,
      authorFilter,
      walletAddress: args.walletAddress,
      selectedChainIds: selectedIds
    });
    const cached = REMOTE_SEARCH_CACHE.get(cacheKey);
    if (cached) {
      setRemoteSearchPosts(cached);
      setIsRemoteSearchLoading(false);
      return () => {
        active = false;
      };
    }

    const loadSearch = async () => {
      if (!active) return;
      setIsRemoteSearchLoading(true);
      const next = await loadRemoteSearchPostsFromSubgraphs({
        selectedChainIds: selectedIds,
        searchQuery: trimmedQuery,
        walletAddress: args.walletAddress,
        authorFilter
      });
      if (!active) return;
      setCacheWithCap(REMOTE_SEARCH_CACHE, cacheKey, next);
      setRemoteSearchPosts(next);
      setIsRemoteSearchLoading(false);
    };

    void loadSearch();

    return () => {
      active = false;
    };
  }, [
    enableSubgraphQueries,
    appliedSearchQuery,
    selectedNetworkChainIds,
    supportedNetworks,
    args.walletAddress,
    authorFilter
  ]);

  const trimmedQuery = appliedSearchQuery.trim();
  const noNetworksSelected = effectiveSelectedNetworkChainIds.length === 0;
  const visiblePostsCount = filteredPosts.length;
  const isPillLoading =
    isRemoteSearchLoading ||
    (countMode === "auto" &&
      !noNetworksSelected &&
      !trimmedQuery &&
      enableSubgraphQueries &&
      (Boolean(args.isFeedLoading) || (authorFilter ? isAuthorPostsLoading : isTotalPostsLoading)));
  const pillText = noNetworksSelected
    ? ""
    : isPillLoading
      ? ""
      : trimmedQuery
        ? `${visiblePostsCount} ${visiblePostsCount === 1 ? "post" : "posts"}`
        : countMode === "visible"
          ? `${visiblePostsCount} ${visiblePostsCount === 1 ? "post" : "posts"}`
          : `${authorFilter ? Math.max(authorPostsCount ?? 0, visiblePostsCount) : Math.max(totalPostsCount ?? 0, visiblePostsCount)} posts`;

  const isDisplayLoading = Boolean(args.isFeedLoading) || isRemoteSearchLoading;
  const displayPosts = isRemoteSearchLoading ? [] : filteredPosts;

  return {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    appliedSearchQuery,
    submitSearch,
    isSearchDirty,
    restoreDraftToApplied,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    filteredPosts,
    displayPosts,
    isDisplayLoading,
    pillText,
    isPillLoading,
    isSearchLoading: isRemoteSearchLoading,
    isNetworkFilterActive
  };
}
