import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@types";
import { getErrorMessage } from "@shared/lib/errors";
import { withTimeout } from "@shared/lib/feedQuery";
import { loadFeedFromProvider, type MintedEventLite } from "../services/feedLoader";
import { mergePosts } from "../services/feedPosts";
import { getFeedNetworkTasks } from "../services/feedNetworkTasks";
import { getRpcProvider } from "@shared/lib/rpc";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { postKey } from "./utils";
import { getFeedRefreshConfig } from "./refresh/getFeedRefreshConfig";
import { createResolveRpcContractAddress } from "./refresh/createResolveRpcContractAddress";
import { useHasAnyReadOnlyRpc } from "./refresh/useHasAnyReadOnlyRpc";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

type WalletParams = {
  provider: any;
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

  const postsRef = useRef<Post[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const refreshFeedInFlightRef = useRef<Promise<void> | null>(null);
  const queuedRefreshAccountRef = useRef<string | null | undefined>(undefined);
  const lastRefreshedAccountRef = useRef<string | null>(null);
  const lastRefreshCompletedAtRef = useRef<number>(0);

  const blockTimestampCacheRef = useRef<Map<string, Map<number, number>>>(new Map());
  const mintedEventsCacheRef = useRef<Map<string, { lastScannedBlock: number; events: MintedEventLite[] }>>(new Map());
  const existsPruneCursorRef = useRef<Map<string, number>>(new Map());

  const refreshFeed = useCallback(
    async (accountOverride?: string | null) => {
      const isVitest = typeof (globalThis as any).__vitest_worker__ !== "undefined";
      const MIN_REFRESH_INTERVAL_MS = 1_500;

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
          if (shouldShowLoading) setIsFeedLoading(true);

          const currentChainIdNumber = parseChainIdNumber(chainId);

          const env = import.meta.env as any;
          const { maxLookbackBlocks, configuredNetworks, extraNetworks } = getFeedRefreshConfig({
            env,
            currentChainIdNumber
          });

          if (!provider && extraNetworks.length === 0) return;

          const resolveRpcContractAddress = createResolveRpcContractAddress({ withTimeout });

          const loadFromProvider = async (chainIdNum: number | null, networkProvider: any, readContract: any): Promise<Post[]> => {
            return await loadFeedFromProvider({
              chainIdNum,
              networkProvider,
              readContract,
              maxLookbackBlocks,
              account: account ?? null,
              lastRefreshedAccount: lastRefreshedAccountRef.current,
              postsSnapshot: postsRef.current,
              postKey,
              mintedEventsCache: mintedEventsCacheRef.current,
              blockTimestampCache: blockTimestampCacheRef.current,
              existsPruneCursor: existsPruneCursorRef.current,
              pruneByKeys: (keys) => setPosts((prev) => prev.filter((p) => !keys.has(postKey(p))))
            });
          };

          const networkTasks = await getFeedNetworkTasks({
            currentChainIdNumber,
            configuredNetworks,
            extraNetworks,
            provider,
            walletAddress: walletAddress ?? null,
            ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
            getReadContract: contract.getReadContract,
            getRpcProvider,
            resolveRpcContractAddress,
            taskTimeoutMs: 25_000,
            withTimeout,
            loadFromProvider,
            onLoaded: (loaded) => setPosts((prev) => mergePosts(prev, loaded, postKey))
          });

          const settled = await Promise.allSettled(networkTasks);
          const fulfilled = settled.filter((r): r is PromiseFulfilledResult<Post[]> => r.status === "fulfilled");
          const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

          const anyFulfilled = fulfilled.length > 0;
          if (!anyFulfilled && rejected.length > 0) {
            const warnSomeNetworksFailedToLoad = [
              // eslint-disable-next-line no-console
              console.warn.bind(console),
              () => {}
            ][Number(isVitest)];

            warnSomeNetworksFailedToLoad(
              "Some feed networks failed to load:",
              rejected.map((r) => r.reason)
            );

            throw rejected[0].reason;
          }

          if (shouldShowLoading) {
            setStatus(rejected.length > 0 ? "Feed loaded (some networks failed)." : "Feed loaded.");
          }
        } catch (err) {
          setStatus(getErrorMessage(err));
          throw err;
        } finally {
          if (shouldShowLoading) setIsFeedLoading(false);
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

    const chainChanged = lastChainIdRef.current !== chainId;
    const walletChanged = lastWalletAddressLowerRef.current !== walletAddressLower;

    if (!chainChanged && !walletChanged) return;
    lastChainIdRef.current = chainId;
    lastWalletAddressLowerRef.current = walletAddressLower;

    // On network change, reset state and caches so we don't show stale data.
    if (chainChanged && !isInitialEpoch) {
      setPosts([]);
      postsRef.current = [];
      refreshFeedInFlightRef.current = null;
      queuedRefreshAccountRef.current = undefined;
      lastRefreshedAccountRef.current = null;
      lastRefreshCompletedAtRef.current = 0;
      blockTimestampCacheRef.current = new Map();
      mintedEventsCacheRef.current = new Map();
      existsPruneCursorRef.current = new Map();
    }

    if (!walletChanged && !chainChanged && !isInitialEpoch) return;

    void refreshFeed(walletAddress).catch(() => {
      // refreshFeed already reports status
    });
  }, [provider, walletEpoch, chainId, walletAddress, refreshFeed, hasAnyReadOnlyRpc]);

  useEffect(() => {
    const isVitest = typeof (globalThis as any).__vitest_worker__ !== "undefined";
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

    const id = window.setInterval(refreshNow, 15_000);
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
