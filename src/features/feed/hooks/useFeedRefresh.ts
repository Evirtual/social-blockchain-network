import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@types";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { useEpochGuard } from "@shared/lib/epochGuard";
import { refreshFeedFromNetworks } from "../services/feedRefresh";
import { useHasAnyReadOnlyRpc } from "./refresh/useHasAnyReadOnlyRpc";
import { getEnv } from "@shared/lib/env";
import { isSocialEventsAvailable, subscribeSocialEvents } from "@shared/lib/socialEvents";
import { createEventRefreshThrottle } from "@shared/lib/eventRefreshThrottle";
import type { ChainProvider, ReadContractFactory } from "@features/contract/types";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

type WalletParams = {
  provider: ChainProvider | null;
  walletAddress: string | null;
  chainId: string | null;
  walletEpoch: number;
};

const EVENT_REFRESH_INTERVAL_MS = 15_000;

export function useFeedRefresh(params: {
  wallet: WalletParams;
  contract: ContractLike;
  setStatus: (s: string) => void;
  selectedNetworkChainIds: string[];
  enabled?: boolean;
}) {
  const {
    wallet: { provider, walletAddress, chainId, walletEpoch },
    contract,
    setStatus,
    selectedNetworkChainIds,
    enabled
  } = params;

  const isEnabled = enabled !== false;

  const [posts, setPosts] = useState<Post[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const { bumpEpoch, snapshotEpoch, isStale } = useEpochGuard();

  const postsRef = useRef<Post[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const refreshFeedInFlightRef = useRef<Promise<void> | null>(null);
  const queuedRefreshAccountRef = useRef<string | null | undefined>(undefined);
  const queuedRefreshChainIdRef = useRef<number | null | undefined>(undefined);
  const lastRefreshedAccountRef = useRef<string | null>(null);
  const lastRefreshCompletedAtRef = useRef<number>(0);
  const lastRefreshedNetworksSigRef = useRef<string>("");
  const lastRefreshedChainIdRef = useRef<number | null>(null);

  const selectedNetworksSig = useMemo(() => {
    const ids = Array.isArray(selectedNetworkChainIds) ? selectedNetworkChainIds : [];
    return ids
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice()
      .sort()
      .join(",");
  }, [selectedNetworkChainIds]);

  const selectedNetworkIds = useMemo(() => {
    const ids = Array.isArray(selectedNetworkChainIds) ? selectedNetworkChainIds : [];
    const numeric = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id)) as number[];
    return Array.from(new Set(numeric));
  }, [selectedNetworkChainIds]);

  const refreshFeed = useCallback(
    async (accountOverride?: string | null, chainIdOverride?: number | null) => {
      if (!isEnabled) return;
      const isVitest = typeof (globalThis as { __vitest_worker__?: boolean }).__vitest_worker__ !== "undefined";
      const MIN_REFRESH_INTERVAL_MS = 1_500;
      const refreshEpoch = snapshotEpoch();

      const account = typeof accountOverride === "string" ? accountOverride : walletAddress;
      const targetChainIdNum = typeof chainIdOverride === "number" ? chainIdOverride : null;
      const normalizedAccount = typeof account === "string" ? account.toLowerCase() : null;
      const normalizedLastAccount =
        typeof lastRefreshedAccountRef.current === "string" ? lastRefreshedAccountRef.current.toLowerCase() : null;

      if (refreshFeedInFlightRef.current) {
        queuedRefreshAccountRef.current = account ?? null;
        queuedRefreshChainIdRef.current = targetChainIdNum ?? null;
        try {
          await refreshFeedInFlightRef.current;
        } catch {
          // allow queued refresh attempt even if the in-flight one failed
        }

        const queued = queuedRefreshAccountRef.current;
        queuedRefreshAccountRef.current = undefined;
        const queuedChainId = queuedRefreshChainIdRef.current;
        queuedRefreshChainIdRef.current = undefined;
        if (
          queued !== undefined &&
          (queued !== lastRefreshedAccountRef.current || queuedChainId !== lastRefreshedChainIdRef.current)
        ) {
          await refreshFeed(queued, queuedChainId ?? null);
        }
        return;
      }

      if (!isVitest && postsRef.current.length > 0) {
        const lastCompletedAt = lastRefreshCompletedAtRef.current;
        const now = Date.now();
        if (
          lastCompletedAt > 0 &&
          now - lastCompletedAt < MIN_REFRESH_INTERVAL_MS &&
          normalizedAccount === normalizedLastAccount &&
          lastRefreshedNetworksSigRef.current === selectedNetworksSig &&
          lastRefreshedChainIdRef.current === targetChainIdNum
        ) {
          return;
        }
      }

      const task = (async () => {
        let shouldShowLoading = false;
        try {
          shouldShowLoading = postsRef.current.length === 0;
          if (shouldShowLoading && !isStale(refreshEpoch)) {
            setIsFeedLoading(true);
          }

          const setPostsGuarded = (next: Parameters<typeof setPosts>[0]) => {
            if (isStale(refreshEpoch)) return;
            setPosts(next);
          };
          const setStatusGuarded = (message: string) => {
            if (isStale(refreshEpoch)) return;
            setStatus(message);
          };

          await refreshFeedFromNetworks({
            provider,
            walletAddress,
            chainId,
            account,
            selectedNetworkChainIds,
            targetChainIdNum,
            contract,
            postsSnapshot: postsRef.current,
            setPosts: setPostsGuarded,
            setStatus: setStatusGuarded,
            lastRefreshedAccount: lastRefreshedAccountRef.current,
            shouldReportStatus: shouldShowLoading
          });
        } catch (err) {
          if (!isStale(refreshEpoch)) {
            setStatusFromError(setStatus, err as ErrorInput);
          }
          throw err;
        } finally {
          if (shouldShowLoading && !isStale(refreshEpoch)) {
            setIsFeedLoading(false);
          }
        }
      })();

      refreshFeedInFlightRef.current = task;
      try {
        await task;
      } finally {
        if (refreshFeedInFlightRef.current === task) {
          refreshFeedInFlightRef.current = null;
        }

        lastRefreshedAccountRef.current = account ?? null;
        lastRefreshCompletedAtRef.current = Date.now();
        lastRefreshedNetworksSigRef.current = selectedNetworksSig;
        lastRefreshedChainIdRef.current = targetChainIdNum ?? null;
      }
    },
    [isEnabled, provider, walletAddress, chainId, contract, setStatus, selectedNetworkChainIds, selectedNetworksSig]
  );

  const lastSelectedNetworksSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isEnabled) return;
    const isInitial = lastSelectedNetworksSigRef.current === null;
    if (isInitial) {
      lastSelectedNetworksSigRef.current = selectedNetworksSig;
      return;
    }

    if (lastSelectedNetworksSigRef.current === selectedNetworksSig) return;
    lastSelectedNetworksSigRef.current = selectedNetworksSig;

    // On network filter change, reset state so we don't show stale networks.
    bumpEpoch();
    setIsFeedLoading(false);
    setPosts([]);
    postsRef.current = [];
    refreshFeedInFlightRef.current = null;
    queuedRefreshAccountRef.current = undefined;
    queuedRefreshChainIdRef.current = undefined;
    lastRefreshedAccountRef.current = null;
    lastRefreshCompletedAtRef.current = 0;
    lastRefreshedChainIdRef.current = null;

    void refreshFeed(walletAddress).catch(() => {
      // refreshFeed already reports status
    });
  }, [isEnabled, selectedNetworksSig, bumpEpoch, refreshFeed, walletAddress]);

  const hasAnyReadOnlyRpc = useHasAnyReadOnlyRpc();

  const lastWalletEpochRef = useRef<number>(-1);
  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  const lastWalletAddressLowerRef = useRef<string | null | undefined>(undefined);
  const didInitWalletRefreshRef = useRef(false);

  useEffect(() => {
    if (!isEnabled) return;
    if (!provider && !hasAnyReadOnlyRpc) return;

    const isInitial = !didInitWalletRefreshRef.current;

    const walletAddressLower = walletAddress ? walletAddress.toLowerCase() : null;

    const epochChanged = walletEpoch !== lastWalletEpochRef.current;
    const rawChainChanged = lastChainIdRef.current !== chainId;
    const rawWalletChanged = lastWalletAddressLowerRef.current !== walletAddressLower;

    // Fast exit if nothing meaningful changed.
    if (!epochChanged && !rawChainChanged && !rawWalletChanged && !isInitial) return;

    didInitWalletRefreshRef.current = true;
    lastWalletEpochRef.current = walletEpoch;

    const chainChanged = rawChainChanged;
    const walletChanged = rawWalletChanged;
    lastChainIdRef.current = chainId;
    lastWalletAddressLowerRef.current = walletAddressLower;

    // On network change, reset state so we don't show stale data.
    // Clearing the loading flag is part of the reset. Bumping the epoch makes
    // every in-flight refresh stale, and a stale refresh's finally declines to
    // clear it. Nothing else would: a wallet switch leaves the posts on screen,
    // so the refresh that follows sees a populated feed, never turns the spinner
    // on, and so never turns it off either.
    if ((chainChanged || walletChanged) && !isInitial) {
      bumpEpoch();
      setIsFeedLoading(false);
    }

    if (chainChanged && !isInitial) {
      setPosts([]);
      postsRef.current = [];
      refreshFeedInFlightRef.current = null;
      queuedRefreshAccountRef.current = undefined;
      queuedRefreshChainIdRef.current = undefined;
      lastRefreshedAccountRef.current = null;
      lastRefreshCompletedAtRef.current = 0;
      lastRefreshedChainIdRef.current = null;
    }

    void refreshFeed(walletAddress).catch(() => {
      // refreshFeed already reports status
    });
  }, [isEnabled, provider, walletEpoch, chainId, walletAddress, refreshFeed, hasAnyReadOnlyRpc]);

  const eventRefreshTimeoutRef = useRef<number | null>(null);
  const scheduleEventRefresh = useCallback((chainIdNum?: number) => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (eventRefreshTimeoutRef.current != null) return;
    eventRefreshTimeoutRef.current = window.setTimeout(() => {
      eventRefreshTimeoutRef.current = null;
      void refreshFeed(walletAddress, chainIdNum ?? null).catch(() => {
        // already reported
      });
    }, 500);
  }, [refreshFeed, walletAddress]);

  useEffect(() => {
    if (!isEnabled) return;
    if (selectedNetworkIds.length === 0) return;

    const env = getEnv();
    const wsChainIds = selectedNetworkIds.filter((id) => isSocialEventsAvailable(id, env));
    if (wsChainIds.length === 0) return;

    // One throttle per chain, so a burst on one network cannot starve another
    // while still capping each chain's refresh rate.
    const throttles = new Map<number, ReturnType<typeof createEventRefreshThrottle>>();
    const throttleFor = (chainId: number) => {
      const existing = throttles.get(chainId);
      if (existing) return existing;
      const created = createEventRefreshThrottle({
        onRefresh: () => scheduleEventRefresh(chainId),
        intervalMs: EVENT_REFRESH_INTERVAL_MS
      });
      throttles.set(chainId, created);
      return created;
    };

    const off = subscribeSocialEvents({
      chainIds: wsChainIds,
      onEvent: (event) => throttleFor(event.chainId).request(),
      env
    });
    return () => {
      for (const throttle of throttles.values()) throttle.cancel();
      throttles.clear();
      if (eventRefreshTimeoutRef.current != null) {
        window.clearTimeout(eventRefreshTimeoutRef.current);
        eventRefreshTimeoutRef.current = null;
      }
      off();
    };
  }, [isEnabled, selectedNetworkIds, scheduleEventRefresh]);

  useEffect(() => {
    const isVitest = typeof (globalThis as { __vitest_worker__?: boolean }).__vitest_worker__ !== "undefined";
    if (isVitest) return;
    if (!isEnabled) return;
    if (!provider && !hasAnyReadOnlyRpc) return;

    const env = getEnv();
    const shouldPoll = selectedNetworkIds.some((id) => !isSocialEventsAvailable(id, env));
    if (!shouldPoll) return;

    let stopped = false;
    const refreshNow = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refreshFeed(walletAddress).catch(() => {
        // already reported
      });
    };

    const id = window.setInterval(refreshNow, 60_000);

    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [isEnabled, provider, walletAddress, refreshFeed, hasAnyReadOnlyRpc, selectedNetworkIds]);

  return useMemo(
    () => ({
      posts,
      setPosts,
      postsRef,
      isFeedLoading,
      refreshFeed
    }),
    [posts, isFeedLoading, refreshFeed]
  );
}
