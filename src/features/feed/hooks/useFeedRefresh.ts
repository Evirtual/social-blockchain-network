import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@types";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { useEpochGuard } from "@shared/lib/epochGuard";
import { refreshFeedFromNetworks } from "../services/feedRefresh";
import { useHasAnyReadOnlyRpc } from "./refresh/useHasAnyReadOnlyRpc";
import type { ChainProvider, ReadContractFactory } from "@features/contract";

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

export function useFeedRefresh(params: {
  wallet: WalletParams;
  contract: ContractLike;
  setStatus: (s: string) => void;
}) {
  const {
    wallet: { provider, walletAddress, chainId, walletEpoch },
    contract,
    setStatus
  } = params;

  const [posts, setPosts] = useState<Post[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const { bumpEpoch, snapshotEpoch, isStale } = useEpochGuard();

  const postsRef = useRef<Post[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const refreshFeedInFlightRef = useRef<Promise<void> | null>(null);
  const queuedRefreshAccountRef = useRef<string | null | undefined>(undefined);
  const lastRefreshedAccountRef = useRef<string | null>(null);
  const lastRefreshCompletedAtRef = useRef<number>(0);

  const refreshFeed = useCallback(
    async (accountOverride?: string | null) => {
      const isVitest = typeof (globalThis as { __vitest_worker__?: boolean }).__vitest_worker__ !== "undefined";
      const MIN_REFRESH_INTERVAL_MS = 1_500;
      const refreshEpoch = snapshotEpoch();

      const account = typeof accountOverride === "string" ? accountOverride : walletAddress;
      const normalizedAccount = typeof account === "string" ? account.toLowerCase() : null;
      const normalizedLastAccount =
        typeof lastRefreshedAccountRef.current === "string" ? lastRefreshedAccountRef.current.toLowerCase() : null;

      if (refreshFeedInFlightRef.current) {
        queuedRefreshAccountRef.current = account ?? null;
        try {
          await refreshFeedInFlightRef.current;
        } catch {
          // allow queued refresh attempt even if the in-flight one failed
        }

        const queued = queuedRefreshAccountRef.current;
        queuedRefreshAccountRef.current = undefined;
        if (queued !== undefined && queued !== lastRefreshedAccountRef.current) {
          await refreshFeed(queued);
        }
        return;
      }

      if (!isVitest && postsRef.current.length > 0) {
        const lastCompletedAt = lastRefreshCompletedAtRef.current;
        const now = Date.now();
        if (
          lastCompletedAt > 0 &&
          now - lastCompletedAt < MIN_REFRESH_INTERVAL_MS &&
          normalizedAccount === normalizedLastAccount
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
      }
    },
    [provider, walletAddress, chainId, contract, setStatus]
  );

  const hasAnyReadOnlyRpc = useHasAnyReadOnlyRpc();

  const lastWalletEpochRef = useRef<number>(-1);
  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  const lastWalletAddressLowerRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!provider && !hasAnyReadOnlyRpc) return;

    const isInitialEpoch = lastWalletEpochRef.current === -1;
    if (walletEpoch === lastWalletEpochRef.current) return;
    lastWalletEpochRef.current = walletEpoch;

    const walletAddressLower = walletAddress ? walletAddress.toLowerCase() : null;

    const rawChainChanged = lastChainIdRef.current !== chainId;
    const rawWalletChanged = lastWalletAddressLowerRef.current !== walletAddressLower;

    if (!isInitialEpoch && hasAnyReadOnlyRpc && (rawChainChanged || rawWalletChanged)) {
      lastChainIdRef.current = chainId;
      lastWalletAddressLowerRef.current = walletAddressLower;
      return;
    }

    const chainChanged = rawChainChanged;
    const walletChanged = rawWalletChanged;

    if (!chainChanged && !walletChanged) return;
    lastChainIdRef.current = chainId;
    lastWalletAddressLowerRef.current = walletAddressLower;

    // On network change, reset state so we don't show stale data.
    if ((chainChanged || walletChanged) && !isInitialEpoch) {
      bumpEpoch();
    }

    if (chainChanged && !isInitialEpoch) {
      setPosts([]);
      postsRef.current = [];
      refreshFeedInFlightRef.current = null;
      queuedRefreshAccountRef.current = undefined;
      lastRefreshedAccountRef.current = null;
      lastRefreshCompletedAtRef.current = 0;
    }

    if (!walletChanged && !chainChanged && !isInitialEpoch) return;

    void refreshFeed(walletAddress).catch(() => {
      // refreshFeed already reports status
    });
  }, [provider, walletEpoch, chainId, walletAddress, refreshFeed, hasAnyReadOnlyRpc]);

  useEffect(() => {
    const isVitest = typeof (globalThis as { __vitest_worker__?: boolean }).__vitest_worker__ !== "undefined";
    if (isVitest) return;
    if (!provider && !hasAnyReadOnlyRpc) return;

    let stopped = false;
    const refreshNow = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refreshFeed(walletAddress).catch(() => {
        // already reported
      });
    };

    const id = window.setInterval(refreshNow, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshNow();
    };

    document.addEventListener?.("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener?.("visibilitychange", onVisibility);
    };
  }, [provider, walletAddress, refreshFeed, hasAnyReadOnlyRpc]);

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
