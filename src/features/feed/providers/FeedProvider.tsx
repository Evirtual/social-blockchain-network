import { useEffect, useMemo, useRef, useState } from "react";
import { useFeedComments } from "../hooks/useFeedComments";
import { useFeedRefresh } from "../hooks/useFeedRefresh";
import { usePostsByTokenIds } from "../hooks/usePostsByTokenIds";
import { useNetworkFilterState } from "../hooks/useNetworkFilterState";
import { useSupportedNetworks } from "../hooks/useSupportedNetworks";
import { useContractActionsFacade } from "@features/contract";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";
import { getEnv, getEnvBoolean } from "@shared/lib/env";
import { runInFlight } from "@shared/lib/inFlight";
import { fetchPosterGateStatuses } from "@shared/lib/posterStatus";
import { generateDemoPosts } from "../services/demo/demoPosts";
import { generateDemoComments } from "../services/demo/demoComments";
import { commentKey } from "@features/post/services";
import {
  FeedActionsContext,
  FeedContext,
  FeedStateContext,
  type FeedActions,
  type FeedContextValue,
  type FeedState,
  type LoadPostsByTokenIdsResult
} from "./feedStateContext";

export type { FeedContextValue } from "./feedStateContext";

function getDemoSeed(): number {
  try {
    const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (cryptoObj?.getRandomValues) {
      const a = new Uint32Array(1);
      cryptoObj.getRandomValues(a);
      return a[0] ?? Date.now();
    }
  } catch {
    // ignore
  }
  return Date.now();
}

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId, walletEpoch } = useWalletState();
  const { setStatus } = useStatusActions();
  const contract = useContractActionsFacade();
  const getReadContractRef = useRef(contract.getReadContract);
  useEffect(() => {
    getReadContractRef.current = contract.getReadContract;
  }, [contract.getReadContract]);

  const demoModeEnabled = useMemo(() => {
    const env = getEnv();
    return getEnvBoolean(env, "VITE_DEMO_MODE", false);
  }, []);

  const debug = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    const env = getEnv();
    const enabled = getEnvBoolean(env, "VITE_DEBUG_FEED_GATE", false);
    if (!enabled) return null;
    return (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.log("[FeedProvider]", ...args);
    };
  }, []);

  const [approvalStatus, setApprovalStatus] = useState<"unknown" | "approved" | "not-approved">("unknown");
  const approvalPollRef = useRef<number | null>(null);
  const approvalPollInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const approvalBurstTimeoutsRef = useRef<number[]>([]);
  const approvalUnknownTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!demoModeEnabled) {
      setApprovalStatus("approved");
      return;
    }

    if (!walletAddress) {
      setApprovalStatus("unknown");
      debug?.("demo enabled; wallet disconnected");
      if (approvalPollRef.current !== null) {
        window.clearInterval(approvalPollRef.current);
        approvalPollRef.current = null;
      }
      for (const t of approvalBurstTimeoutsRef.current) window.clearTimeout(t);
      approvalBurstTimeoutsRef.current = [];
      if (approvalUnknownTimeoutRef.current !== null) {
        window.clearTimeout(approvalUnknownTimeoutRef.current);
        approvalUnknownTimeoutRef.current = null;
      }
      return;
    }

    // Connected: until we get a definitive answer, treat approval as unknown.
    setApprovalStatus("unknown");
    if (approvalUnknownTimeoutRef.current !== null) {
      window.clearTimeout(approvalUnknownTimeoutRef.current);
      approvalUnknownTimeoutRef.current = null;
    }
    // Safety: if the provider is flaky and we can't determine approval quickly,
    // fall back to showing demo posts rather than an infinite skeleton.
    approvalUnknownTimeoutRef.current = window.setTimeout(() => {
      setApprovalStatus((prev) => (prev === "unknown" ? "not-approved" : prev));
    }, 6_000);

    let cancelled = false;

    const stopPolling = () => {
      if (approvalUnknownTimeoutRef.current !== null) {
        window.clearTimeout(approvalUnknownTimeoutRef.current);
        approvalUnknownTimeoutRef.current = null;
      }
      if (approvalPollRef.current !== null) {
        window.clearInterval(approvalPollRef.current);
        approvalPollRef.current = null;
      }
      for (const t of approvalBurstTimeoutsRef.current) window.clearTimeout(t);
      approvalBurstTimeoutsRef.current = [];
    };

    const checkOnce = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        debug?.("approval check: start", { chainId, walletAddress });
        const key = `${String(chainId ?? "")}::${walletAddress.toLowerCase()}`;
        await runInFlight(approvalPollInFlightRef.current, key, async () => {
          // IMPORTANT: Do not call ensureContractDeployed here.
          // Some wallet RPCs/extensions fail on eth_getCode even though eth_call works.
          // Approval gating only needs read calls like isPosterAllowed.
          const readContract = await getReadContractRef.current();
          // Use the same compatibility path as the composer: only requires
          // isPosterAllowed + hasPosterRequested (older deployments may not have wasPosterDisapproved).
          const statuses = await fetchPosterGateStatuses(readContract, [walletAddress]);
          const allowed = statuses[0]?.allowed ?? false;
          if (cancelled) return;
          setApprovalStatus(Boolean(allowed) ? "approved" : "not-approved");
          debug?.("approval check: result", { chainId, walletAddress, allowed: Boolean(allowed) });
          if (allowed) stopPolling();
        });
      } catch (err) {
        // Don't force "false" here. If the check fails due to transient RPC/contract issues,
        // treating it as disapproved makes demo mode look permanent.
        debug?.("approval check: error", { chainId, walletAddress, err });
      }
    };

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void checkOnce();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    void checkOnce();

    // Burst a couple of quick retries right after connect / chain change.
    // This avoids the UX feeling "stuck" while the injected provider settles.
    for (const t of approvalBurstTimeoutsRef.current) window.clearTimeout(t);
    approvalBurstTimeoutsRef.current = [
      window.setTimeout(() => void checkOnce(), 750),
      window.setTimeout(() => void checkOnce(), 2_500)
    ];

    if (approvalPollRef.current !== null) {
      window.clearInterval(approvalPollRef.current);
      approvalPollRef.current = null;
    }

    approvalPollRef.current = window.setInterval(() => {
      void checkOnce();
    }, 10_000);

    debug?.("demo enabled; approval polling armed", { chainId, walletAddress });

    return () => {
      cancelled = true;
      stopPolling();

      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [demoModeEnabled, walletAddress, chainId, debug]);

  useEffect(() => {
    if (!demoModeEnabled) return;
    debug?.("gate", {
      chainId,
      walletAddress,
      approvalStatus,
      isLiveFeedEnabled: !!walletAddress && approvalStatus === "approved"
    });
  }, [demoModeEnabled, chainId, walletAddress, approvalStatus, debug]);

  const isLiveFeedEnabled = !demoModeEnabled || (!!walletAddress && approvalStatus === "approved");
  const showApprovalLoading = demoModeEnabled && !!walletAddress && !isLiveFeedEnabled && approvalStatus === "unknown";
  const demoStep: FeedState["demoStep"] = !demoModeEnabled
    ? null
    : !walletAddress
      ? "connect"
      : isLiveFeedEnabled
        ? null
        : "approve";

  const [demoPosts, setDemoPosts] = useState(() =>
    generateDemoPosts({
      seed: getDemoSeed(),
      totalCount: 14,
      imagePostRatio: 0.65,
      featuredAuthor: walletAddress,
      featuredCount: 2
    })
  );
  const demoPostsRef = useRef(demoPosts);
  useEffect(() => {
    demoPostsRef.current = demoPosts;
  }, [demoPosts]);

  useEffect(() => {
    if (!demoModeEnabled) return;
    if (isLiveFeedEnabled) return;
    if (showApprovalLoading) return;
    // Ensure demo feed isn't empty if user comes back later.
    if (demoPostsRef.current.length) return;
    setDemoPosts(
      generateDemoPosts({
        seed: getDemoSeed(),
        totalCount: 14,
        imagePostRatio: 0.65,
        featuredAuthor: walletAddress,
        featuredCount: 2
      })
    );
  }, [demoModeEnabled, isLiveFeedEnabled, showApprovalLoading]);

  const supportedNetworks = useSupportedNetworks();
  const { selectedNetworkChainIds } = useNetworkFilterState({
    searchQueryKey: "socialBlockchainNetwork.feed.searchQuery",
    selectedNetworksKey: "socialBlockchainNetwork.feed.selectedNetworks",
    walletAddress,
    chainId,
    supportedNetworks
  });

  const contractApi = useMemo(
    () => ({
      ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
      getReadContract: contract.getReadContract
    }),
    [contract.ensureContractDeployedOnCurrentNetwork, contract.getReadContract]
  );

  const feedRefresh = useFeedRefresh({
    wallet: { provider, walletAddress, chainId, walletEpoch },
    contract: contractApi,
    setStatus,
    selectedNetworkChainIds,
    enabled: isLiveFeedEnabled
  });

  const wasLiveFeedEnabledRef = useRef<boolean>(isLiveFeedEnabled);
  useEffect(() => {
    const wasLive = wasLiveFeedEnabledRef.current;
    wasLiveFeedEnabledRef.current = isLiveFeedEnabled;
    if (!demoModeEnabled) return;
    if (wasLive) return;
    if (!isLiveFeedEnabled) return;
    void feedRefresh.refreshFeed(walletAddress).catch(() => {
      // refreshFeed already reports status
    });
  }, [demoModeEnabled, isLiveFeedEnabled, feedRefresh.refreshFeed, walletAddress]);

  const comments = useFeedComments({
    provider,
    chainId,
    walletAddress,
    contract: contractApi,
    setStatus,
    postsRef: feedRefresh.postsRef
  });

  const postsByTokenIds = usePostsByTokenIds({
    provider,
    chainId,
    walletAddress,
    contract: contractApi,
    postsRef: feedRefresh.postsRef,
    setPosts: feedRefresh.setPosts
  });

  const stateValue = useMemo<FeedState>(
    () => ({
      posts: isLiveFeedEnabled ? feedRefresh.posts : showApprovalLoading ? [] : demoPosts,
      isFeedLoading: isLiveFeedEnabled ? feedRefresh.isFeedLoading : showApprovalLoading,
      postComments: comments.postComments,
      isLoadingPostComments: comments.isLoadingPostComments,

      isDemoModeEnabled: demoModeEnabled,
      isLiveFeedEnabled,
      demoStep
    }),
    [
      isLiveFeedEnabled,
      feedRefresh.posts,
      feedRefresh.isFeedLoading,
      comments.postComments,
      comments.isLoadingPostComments,
      demoModeEnabled,
      demoStep,
      showApprovalLoading,
      demoPosts
    ]
  );

  const actionsValue = useMemo<FeedActions>(
    () => ({
      setPosts: (updater) => {
        if (!isLiveFeedEnabled) return;
        feedRefresh.setPosts(updater);
      },
      refreshFeed: async (accountOverride?: string | null) => {
        if (!isLiveFeedEnabled) {
          if (!demoModeEnabled || showApprovalLoading) return;
          setDemoPosts(
            generateDemoPosts({
              seed: getDemoSeed(),
              totalCount: 14,
              imagePostRatio: 0.65,
              featuredAuthor: walletAddress,
              featuredCount: 2
            })
          );
          return;
        }
        await feedRefresh.refreshFeed(accountOverride);
      },
      setPostComments: comments.setPostComments,
      loadCommentsForPost: async (tokenId: string, postChainId?: string | null) => {
        if (!isLiveFeedEnabled) {
          if (!demoModeEnabled || showApprovalLoading) return;

          const keyChainId = postChainId ?? null;
          const key = commentKey(keyChainId, tokenId);
          const existing = comments.postComments[key];
          if (existing !== undefined) return;

          const post = demoPostsRef.current.find(
            (p) => p.tokenId === tokenId && (postChainId ? String(p.chainId ?? "") === String(postChainId) : true)
          );
          const count = typeof post?.comments === "number" ? post.comments : 0;

          comments.setPostComments((prev) => ({
            ...prev,
            [key]: generateDemoComments({ tokenId, postChainId: keyChainId, count })
          }));
          return;
        }

        await comments.loadCommentsForPost(tokenId, postChainId);
      },
      loadPostsByTokenIds: async (tokenIds: string[], postChainId?: string | null) => {
        if (!isLiveFeedEnabled) {
          return { didFetch: false, posts: [] } satisfies LoadPostsByTokenIdsResult;
        }
        return await postsByTokenIds.loadPostsByTokenIds(tokenIds, postChainId);
      }
    }),
    [
      isLiveFeedEnabled,
      demoModeEnabled,
      showApprovalLoading,
      demoModeEnabled,
      showApprovalLoading,
      feedRefresh.setPosts,
      feedRefresh.refreshFeed,
      comments.postComments,
      comments.setPostComments,
      comments.loadCommentsForPost,
      postsByTokenIds.loadPostsByTokenIds
    ]
  );

  const value = useMemo<FeedContextValue>(() => ({ ...stateValue, ...actionsValue }), [stateValue, actionsValue]);

  return (
    <FeedStateContext.Provider value={stateValue}>
      <FeedActionsContext.Provider value={actionsValue}>
        <FeedContext.Provider value={value}>{children}</FeedContext.Provider>
      </FeedActionsContext.Provider>
    </FeedStateContext.Provider>
  );
}
