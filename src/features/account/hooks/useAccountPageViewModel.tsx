import { useEffect, useMemo, useState } from "react";
import type { Post } from "@types";
import { AccountFeedHeaderAction } from "../components/AccountFeedHeaderAction";
import { useAccountFeedView } from "./useAccountFeedView";
import { useFeedFilterViewModel } from "@features/feed";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import { getEnv } from "@shared/lib/env";

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

    const cacheKey = `socialBlockchainNetwork.account.counts.${walletLower}.${selectedIds
      .slice()
      .sort()
      .join(",")}`;
    const cacheTtlMs = 5 * 60 * 1000;

    const loadCounts = async () => {
      if (active) setIsAccountCountsLoading(true);
      if (typeof window !== "undefined") {
        try {
          const cachedRaw = window.sessionStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as { posted?: number; saved?: number; liked?: number; ts?: number };
            if (
              typeof cached?.posted === "number" &&
              typeof cached?.saved === "number" &&
              typeof cached?.liked === "number" &&
              typeof cached?.ts === "number" &&
              Date.now() - cached.ts < cacheTtlMs
            ) {
              if (active) setAccountCounts({ posted: cached.posted, saved: cached.saved, liked: cached.liked });
              if (active) setIsAccountCountsLoading(false);
              return;
            }
          }
        } catch {
          // Ignore cache read errors.
        }
      }

      const env = getEnv();
      let postedSum = 0;
      let savedSum = 0;
      let likedSum = 0;

      for (const id of selectedIds) {
        const chainIdNum = Number(id);
        if (!Number.isFinite(chainIdNum)) continue;
        const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
        if (!subgraphUrl) continue;
        const result = await tryQuerySubgraph<{
          account: { postedCount?: string | null; savedCount?: string | null; likedCount?: string | null } | null;
        }>({
          url: subgraphUrl,
          query: `query AccountCounts($id: ID!) { account(id: $id) { postedCount savedCount likedCount } }`,
          variables: { id: walletLower },
          timeoutMs: 8_000
        });
        if (!result.ok) continue;
        const posted = Number(result.data?.account?.postedCount ?? 0);
        const saved = Number(result.data?.account?.savedCount ?? 0);
        const liked = Number(result.data?.account?.likedCount ?? 0);
        if (Number.isFinite(posted)) postedSum += posted;
        if (Number.isFinite(saved)) savedSum += saved;
        if (Number.isFinite(liked)) likedSum += liked;
      }

      if (!active) return;
      setAccountCounts({ posted: postedSum, saved: savedSum, liked: likedSum });
      setIsAccountCountsLoading(false);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ posted: postedSum, saved: savedSum, liked: likedSum, ts: Date.now() })
          );
        } catch {
          // Ignore cache write errors.
        }
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
    const isLoading = activeLoading || isAccountCountsLoading;
    return (
      <AccountFeedHeaderAction
        view={view}
        onViewChange={setView}
        postedCount={resolvedPosted}
        savedCount={resolvedSaved}
        likedCount={resolvedLiked}
        isLoading={isLoading}
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
