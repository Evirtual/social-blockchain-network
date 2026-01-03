import { useEffect, useMemo, useState } from "react";
import type { Post } from "@types";
import { useSupportedNetworks } from "./useSupportedNetworks";
import { useNetworkFilterState } from "./useNetworkFilterState";
import { filterPosts } from "../services/filterPosts";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import { loadFeedFromSubgraph } from "@features/feed/services/subgraph/loadFeedFromSubgraph";
import { getEnv } from "@shared/lib/env";

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
  authorAddress?: string | null;
  countMode?: "auto" | "visible";
};

export function useFeedFilterViewModel(args: Args) {
  const countMode: "auto" | "visible" = args.countMode ?? "auto";
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
      selectedNetworkChainIds
    });
  }, [scopedPosts, args.authorIdentity, args.shortAddress, searchQuery, selectedNetworkChainIds]);

  useEffect(() => {
    if (countMode !== "auto") {
      setTotalPostsCount(null);
      setIsTotalPostsLoading(false);
      return;
    }

    let active = true;
    const env = getEnv();
    const selectedIds = selectedNetworkChainIds.length
      ? selectedNetworkChainIds
      : supportedNetworks.map((n) => String(n.chainId));
    const cacheKey = `socialBlockchainNetwork.feed.totalPosts.${selectedIds.slice().sort().join(",")}`;
    const cacheTtlMs = 5 * 60 * 1000;

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
        if (typeof window !== "undefined") {
          try {
            const cachedRaw = window.sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw) as { count?: number; ts?: number };
              if (
                typeof cached?.count === "number" &&
                typeof cached?.ts === "number" &&
                Date.now() - cached.ts < cacheTtlMs
              ) {
                if (active) setTotalPostsCount(cached.count);
                return;
              }
            }
          } catch {
            // Ignore cache read errors.
          }
        }

        let sum = 0;
        for (const id of selectedIds) {
          const chainIdNum = Number(id);
          if (!Number.isFinite(chainIdNum)) continue;
          const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
          if (!subgraphUrl) continue;
          const result = await tryQuerySubgraph<{
            globalStats: { totalPosts?: string | null } | null;
          }>({
            url: subgraphUrl,
            query: `query GlobalStats { globalStats(id: "global") { totalPosts } }`,
            variables: {},
            timeoutMs: 8_000
          });
          if (!result.ok) continue;
          const total = Number(result.data?.globalStats?.totalPosts ?? 0);
          if (Number.isFinite(total)) sum += total;
        }
        if (active) setTotalPostsCount(sum);
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(cacheKey, JSON.stringify({ count: sum, ts: Date.now() }));
          } catch {
            // Ignore cache write errors.
          }
        }
      } finally {
        if (active) setIsTotalPostsLoading(false);
      }
    };

    void loadTotals();

    return () => {
      active = false;
    };
  }, [countMode, supportedNetworks, selectedNetworkChainIds, authorFilter]);

  useEffect(() => {
    if (countMode !== "auto") {
      setAuthorPostsCount(null);
      setIsAuthorPostsLoading(false);
      return;
    }

    let active = true;
    const env = getEnv();
    const selectedIds = selectedNetworkChainIds.length
      ? selectedNetworkChainIds
      : supportedNetworks.map((n) => String(n.chainId));
    const cacheKey = `socialBlockchainNetwork.profile.posts.${authorFilter}.${selectedIds.slice().sort().join(",")}`;
    const cacheTtlMs = 5 * 60 * 1000;

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
        if (typeof window !== "undefined") {
          try {
            const cachedRaw = window.sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw) as { count?: number; ts?: number };
              if (
                typeof cached?.count === "number" &&
                typeof cached?.ts === "number" &&
                Date.now() - cached.ts < cacheTtlMs
              ) {
                if (active) setAuthorPostsCount(cached.count);
                return;
              }
            }
          } catch {
            // Ignore cache read errors.
          }
        }

        let sum = 0;
        for (const id of selectedIds) {
          const chainIdNum = Number(id);
          if (!Number.isFinite(chainIdNum)) continue;
          const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
          if (!subgraphUrl) continue;
          const result = await tryQuerySubgraph<{
            account: { postedCount?: string | null } | null;
          }>({
            url: subgraphUrl,
            query: `query AccountPosts($id: ID!) { account(id: $id) { postedCount } }`,
            variables: { id: authorFilter },
            timeoutMs: 8_000
          });
          if (!result.ok) continue;
          const count = Number(result.data?.account?.postedCount ?? 0);
          if (Number.isFinite(count)) sum += count;
        }
        if (active) setAuthorPostsCount(sum);
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(cacheKey, JSON.stringify({ count: sum, ts: Date.now() }));
          } catch {
            // Ignore cache write errors.
          }
        }
      } finally {
        if (active) setIsAuthorPostsLoading(false);
      }
    };

    void loadAuthorTotals();

    return () => {
      active = false;
    };
  }, [countMode, supportedNetworks, selectedNetworkChainIds, authorFilter]);

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

    if (!args.useSubgraphSearch || !trimmedQuery || trimmedQuery.length < minQueryLength) {
      setRemoteSearchPosts(null);
      return () => {
        active = false;
      };
    }

    const env = getEnv();
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
      const collected: Post[] = [];
      let hadSuccess = false;
      let hadFailure = false;
      for (const id of selectedIds) {
        const chainIdNum = Number(id);
        if (!Number.isFinite(chainIdNum)) continue;
        const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
        if (!subgraphUrl) continue;
        const authorIds: string[] = [];
        const cacheKey = `socialBlockchainNetwork.search.authors.${subgraphUrl}.${trimmedQuery.toLowerCase()}`;

        if (typeof window !== "undefined") {
          try {
            const cachedRaw = window.sessionStorage.getItem(cacheKey);
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw) as { ids?: string[]; ts?: number };
              if (Array.isArray(cached?.ids) && typeof cached?.ts === "number" && Date.now() - cached.ts < 5 * 60 * 1000) {
                authorIds.push(...cached.ids);
              }
            }
          } catch {
            // Ignore cache read errors.
          }
        }

        if (!authorIds.length) {
          try {
            const byName = await tryQuerySubgraph<{ accounts: Array<{ id: string }> }>({
              url: subgraphUrl,
              query: `query AccountByName($query: String!, $first: Int!) { accounts(first: $first, where: { name_contains_nocase: $query }) { id } }`,
              variables: { query: trimmedQuery, first: 50 },
              timeoutMs: 8_000
            });
            if (byName.ok) {
              authorIds.push(...(byName.data?.accounts ?? []).map((a) => a.id));
            }
          } catch {
            // Ignore schema mismatches / query errors.
          }

          try {
            const byId = await tryQuerySubgraph<{ accounts: Array<{ id: string }> }>({
              url: subgraphUrl,
              query: `query AccountById($query: String!, $first: Int!) { accounts(first: $first, where: { id_contains_nocase: $query }) { id } }`,
              variables: { query: trimmedQuery, first: 50 },
              timeoutMs: 8_000
            });
            if (byId.ok) {
              authorIds.push(...(byId.data?.accounts ?? []).map((a) => a.id));
            }
          } catch {
            // Ignore schema mismatches / query errors.
          }

          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(
                cacheKey,
                JSON.stringify({ ids: Array.from(new Set(authorIds)), ts: Date.now() })
              );
            } catch {
              // Ignore cache write errors.
            }
          }
        }

        try {
          const uniqueAuthorIds = Array.from(new Set(authorIds));
          const found = await loadFeedFromSubgraph({
            url: subgraphUrl,
            chainIdStr: String(chainIdNum),
            first: 200,
            account: args.walletAddress ? args.walletAddress.toLowerCase() : null,
            searchQuery: trimmedQuery,
            author: authorFilter || null,
            authorIds: uniqueAuthorIds.length ? uniqueAuthorIds : null
          });
          hadSuccess = true;
          collected.push(...found);
        } catch {
          hadFailure = true;
        }
      }
      if (!active) return;
      if (!hadSuccess) {
        setRemoteSearchPosts(null);
        return;
      }
      if (!collected.length && hadFailure) {
        setRemoteSearchPosts(null);
        return;
      }
      setRemoteSearchPosts(collected.length ? collected : []);
    };

    void loadSearch();

    return () => {
      active = false;
    };
  }, [
    args.useSubgraphSearch,
    debouncedSearchQuery,
    selectedNetworkChainIds,
    supportedNetworks,
    args.walletAddress,
    authorFilter
  ]);

  const trimmedQuery = searchQuery.trim();
  const noNetworksSelected = selectedNetworkChainIds.length === 0;
  const visiblePostsCount = filteredPosts.length;
  const isPillLoading =
    countMode === "auto" &&
    !noNetworksSelected &&
    !trimmedQuery &&
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
