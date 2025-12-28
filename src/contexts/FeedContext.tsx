import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Post, PostComment } from "../types";
import { getSocialContract, socialInterface } from "../contracts/socialPosts";
import { getErrorMessage } from "../lib/errors";
import { mapWithConcurrency } from "../lib/async";
import { fetchTokenMetadata } from "../lib/metadata";
import { getConfiguredFeedNetworks, type FeedNetworkConfig } from "../lib/feedNetworks";
import { queryLogsPaged, withTimeout } from "../lib/feedQuery";
import { loadFeedFromProvider, type MintedEventLite } from "../lib/feedLoader";
import { resolveSocialPostsAddress } from "../lib/resolveSocialPostsAddress";
import { mergePosts } from "../lib/feedPosts";
import { getFeedNetworkTasks } from "../lib/feedNetworkTasks";
import { getRpcProvider } from "../lib/rpc";
import { runInFlight } from "../lib/inFlight";
import { parseChainIdNumber } from "../lib/chainId";
import { useContract } from "./ContractContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";

function postKey(p: Pick<Post, "tokenId" | "chainId">) {
  return `${p.chainId ?? ""}:${p.tokenId}`;
}

function commentKey(chainId: string | null | undefined, tokenId: string) {
  return chainId ? `${chainId}:${tokenId}` : tokenId;
}

export type FeedContextValue = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;

  isFeedLoading: boolean;
  refreshFeed: (accountOverride?: string | null) => Promise<void>;

  postComments: Record<string, PostComment[]>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
  isLoadingPostComments: Record<string, boolean>;
  loadCommentsForPost: (tokenId: string, postChainId?: string | null) => Promise<void>;

  loadPostsByTokenIds: (tokenIds: string[], postChainId?: string | null) => Promise<void>;
};

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId, walletEpoch } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();

  const ensureContractDeployedOnCurrentNetwork = contract.ensureContractDeployedOnCurrentNetwork;
  const getReadContract = contract.getReadContract;

  const [posts, setPosts] = useState<Post[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);
  const postsRef = useRef<Post[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [isLoadingPostComments, setIsLoadingPostComments] = useState<Record<string, boolean>>({});

  const refreshFeedInFlightRef = useRef<Promise<void> | null>(null);
  const queuedRefreshAccountRef = useRef<string | null | undefined>(undefined);
  const lastRefreshedAccountRef = useRef<string | null>(null);
  const lastRefreshCompletedAtRef = useRef<number>(0);
  const commentsInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const commentsCacheRef = useRef<Map<string, { lastScannedBlock: number; comments: PostComment[] }>>(new Map());

  const blockTimestampCacheRef = useRef<Map<string, Map<number, number>>>(new Map());

  const mintedEventsCacheRef = useRef<Map<string, { lastScannedBlock: number; events: MintedEventLite[] }>>(new Map());

  const existsPruneCursorRef = useRef<Map<string, number>>(new Map());

  // React to account/chain changes emitted by WalletContext.
  const lastWalletEpochRef = useRef<number>(-1);
  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  const lastWalletAddressLowerRef = useRef<string | null | undefined>(undefined);

  const loadCommentsForPost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      const env = import.meta.env as any;
      const configuredNetworks = getConfiguredFeedNetworks(env);

      const targetChainId = parseChainIdNumber(postChainId ?? chainId);
      const targetCfg = targetChainId != null ? configuredNetworks.find((n) => n.chainId === targetChainId) : undefined;
      const targetRpcUrl = typeof targetCfg?.rpcUrl === "string" ? String(targetCfg.rpcUrl).trim() : "";

      const canUseEnvRpc = !!targetCfg && !!targetRpcUrl;
      if (!provider && !canUseEnvRpc) return;

      const tokenIdBig = BigInt(tokenId);

      const key = commentKey(postChainId ?? chainId, tokenId);

      const readProvider: any = canUseEnvRpc ? getRpcProvider(targetRpcUrl, targetCfg!.chainId) : provider;
      const readContract: any = canUseEnvRpc
        ? getSocialContract(await resolveSocialPostsAddress(targetCfg!, readProvider), readProvider)
        : await (async () => {
            await ensureContractDeployedOnCurrentNetwork();
            return await getReadContract();
          })();

      await runInFlight(commentsInFlightRef.current, key, async () => {
        setIsLoadingPostComments((prev) => ({ ...prev, [key]: true }));
        try {
          const latestAny = await withTimeout<any>(readProvider.getBlockNumber(), 6_000, "comments getBlockNumber");
          const latest = Number(latestAny);
          if (!Number.isFinite(latest) || latest < 0) {
            setPostComments((prev) => ({ ...prev, [key]: [] }));
            return;
          }

          const cached = commentsCacheRef.current.get(key);

          const mintHint = postsRef.current.find((p) => {
            if (p.tokenId !== tokenId) return false;
            if (postChainId && p.chainId && p.chainId !== postChainId) return false;
            if (postChainId && !p.chainId) return false;
            return true;
          })?.mintBlockNumber;

          // Avoid scanning from genesis on large chains; use mint block when known,
          // otherwise cap to a recent window to keep the UI responsive.
          const defaultFromBlock = (() => {
            if (typeof mintHint === "number" && Number.isFinite(mintHint) && mintHint >= 0) return Math.floor(mintHint);
            return Math.max(0, latest - 25_000);
          })();

          const fromBlock = cached ? Math.max(0, cached.lastScannedBlock + 1) : defaultFromBlock;
          if (fromBlock > latest) {
            // Nothing new.
            if (cached) {
              setPostComments((prev) => (prev[key] === cached.comments ? prev : { ...prev, [key]: cached.comments }));
            }
            return;
          }

          const filter = readContract.filters.PostCommented(null, tokenIdBig);
          const logs = await queryLogsPaged({
            readContract,
            filter,
            fromBlock,
            toBlock: latest,
            label: `comments ${tokenId}`,
            timeoutMs: 8_000,
            initialChunkSize: 50_000,
            minChunkSize: 250
          });

          const parsedNew: PostComment[] = logs.flatMap((log: any) => {
            const desc = socialInterface.parseLog(log);
            if (!desc) return [];
            return [
              {
                commenter: String(desc.args.commenter),
                comment: String(desc.args.comment),
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                logIndex: log.logIndex
              } satisfies PostComment
            ];
          });

          const merged = (() => {
            const prevComments = cached?.comments ?? [];
            if (prevComments.length === 0) return parsedNew;
            if (parsedNew.length === 0) return prevComments;

            const seen = new Set<string>();
            for (const c of prevComments) {
              const sig = `${c.txHash ?? ""}:${c.logIndex ?? -1}`;
              if (c.txHash) seen.add(sig);
            }

            const next = prevComments.slice();
            for (const c of parsedNew) {
              if (c.txHash) {
                const sig = `${c.txHash}:${c.logIndex ?? -1}`;
                if (seen.has(sig)) continue;
                seen.add(sig);
              }
              next.push(c);
            }
            return next;
          })().sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));

          commentsCacheRef.current.set(key, { lastScannedBlock: latest, comments: merged });
          setPostComments((prev) => ({ ...prev, [key]: merged }));
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingPostComments((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [provider, chainId, ensureContractDeployedOnCurrentNetwork, getReadContract, setStatus]
  );

  const loadPostsByTokenIds = useCallback(
    async (tokenIds: string[], postChainId?: string | null) => {
      if (!tokenIds.length) return;

      const currentChainId = parseChainIdNumber(postChainId ?? chainId);

      const env = import.meta.env as any;
      const configuredNetworks = getConfiguredFeedNetworks(env);

      const currentCfg = currentChainId != null ? configuredNetworks.find((n) => n.chainId === currentChainId) : undefined;
      const currentRpcUrl = typeof currentCfg?.rpcUrl === "string" ? String(currentCfg.rpcUrl).trim() : "";

      const resolveRpcContractAddress = async (cfg: FeedNetworkConfig, rpcProvider: any) => {
        return await resolveSocialPostsAddress(cfg, rpcProvider);
      };

      // Prefer env RPC for current-chain reads when configured (more reliable than some wallet RPCs).
      // Fallback to the injected provider when no env RPC exists.
      const canUseEnvRpc = !!currentCfg && !!currentRpcUrl;
      if (!provider && !canUseEnvRpc) return;

      const readProvider: any = canUseEnvRpc ? getRpcProvider(currentRpcUrl, currentCfg!.chainId) : provider;

      const readContract = canUseEnvRpc
        ? getSocialContract(await resolveRpcContractAddress(currentCfg!, readProvider), readProvider)
        : await (async () => {
            await ensureContractDeployedOnCurrentNetwork();
            return await getReadContract();
          })();
      const existing = new Set(
        postsRef.current
          .filter((p) => {
            const pChain = parseChainIdNumber(p.chainId ?? null);
            return currentChainId == null || pChain == null || pChain === currentChainId;
          })
          .map((p) => p.tokenId)
      );
      const missing = Array.from(new Set(tokenIds)).filter((id) => id && !existing.has(id));
      if (missing.length === 0) return;

      const fetched = await (async () => {
        // Fallback: individual calls per token.
        return await mapWithConcurrency(missing, 6, async (id) => {
          const tokenIdBig = BigInt(id);
          let tokenUri = "";
          let likesRaw = 0n;
          let commentsRaw = 0n;
          let savesRaw = 0n;
          let tipsWei = 0n;
          let author = "";
          let likedByMe: boolean | undefined;
          let savedByMe: boolean | undefined;
          try {
            [tokenUri, likesRaw, commentsRaw, savesRaw, tipsWei, author, likedByMe, savedByMe] = await Promise.all([
              (readContract as any).tokenURI(tokenIdBig) as Promise<string>,
              (readContract as any).likesOf(tokenIdBig) as Promise<bigint>,
              (readContract as any).commentsOf(tokenIdBig) as Promise<bigint>,
              (readContract as any).savesOf(tokenIdBig) as Promise<bigint>,
              (readContract as any).tipsOf(tokenIdBig) as Promise<bigint>,
              (readContract as any).authorOf(tokenIdBig) as Promise<string>,
              walletAddress
                ? ((readContract as any).hasLiked(tokenIdBig, walletAddress) as Promise<boolean>)
                : Promise.resolve(undefined),
              walletAddress
                ? ((readContract as any).hasSaved(tokenIdBig, walletAddress) as Promise<boolean>)
                : Promise.resolve(undefined)
            ]);
          } catch {
            return null;
          }

          const meta = await fetchTokenMetadata(tokenUri);
          const post: Post = {
            tokenId: id,
            chainId: currentChainId != null ? String(currentChainId) : undefined,
            title: meta?.name ?? `Token #${id}`,
            body: meta?.description ?? "",
            image: meta?.image ?? "",
            animationUrl: meta?.animation_url,
            metadataURI: tokenUri,
            author,
            likes: Number(likesRaw),
            comments: Number(commentsRaw),
            saves: Number(savesRaw),
            tipsWei,
            likedByMe,
            savedByMe
          };
          return post;
        });
      })();

      const toAdd = fetched.filter((p): p is Post => p != null);
      if (toAdd.length === 0) return;

      setPosts((prev) => {
        const byId = new Map(prev.map((p) => [postKey(p), p] as const));
        for (const p of toAdd) byId.set(postKey(p), p);
        return Array.from(byId.values());
      });
    },
    [provider, chainId, ensureContractDeployedOnCurrentNetwork, getReadContract, walletAddress]
  );

  const refreshFeed = useCallback(
    async (accountOverride?: string | null) => {
      const isVitest = typeof (globalThis as any).__vitest_worker__ !== "undefined";

      // Coalesce back-to-back refresh triggers (mount + visibility + interval + post actions).
      // Keep initial load immediate.
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
          // Browser RPCs are frequently rate-limited and slow for historical `eth_getLogs`.
          // Keep the default lookback small enough to avoid timeouts on fresh deployments.
          const maxLookbackBlocksRaw = Number(env.VITE_FEED_MAX_LOOKBACK_BLOCKS ?? 200_000);
          const maxLookbackBlocks =
            Number.isFinite(maxLookbackBlocksRaw) && maxLookbackBlocksRaw > 0 ? maxLookbackBlocksRaw : 200_000;
          const configuredNetworks = getConfiguredFeedNetworks(env);

          // Only include additional networks if a public RPC URL is configured.
          const extraNetworks = configuredNetworks.filter(
            (n) =>
              typeof n.rpcUrl === "string" &&
              n.rpcUrl.trim().length > 0 &&
              (currentChainIdNumber == null || n.chainId !== currentChainIdNumber)
          );

          // If there's no connected wallet provider and no read-only networks are configured,
          // keep the previous behavior (no-op) to avoid spurious status churn.
          if (!provider && extraNetworks.length === 0) return;

          const resolveRpcContractAddress = async (cfg: FeedNetworkConfig, rpcProvider: any) => {
            return await resolveSocialPostsAddress(cfg, rpcProvider, {
              withTimeout,
              codeTimeoutMs: 3_000,
              probeTimeoutMs: 3_000,
              label: `resolve ${cfg.chainId}`
            });
          };

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
            ensureContractDeployedOnCurrentNetwork,
            getReadContract,
            getRpcProvider,
            resolveRpcContractAddress,
            taskTimeoutMs: 25_000,
            withTimeout,
            loadFromProvider,
            onLoaded: (loaded) => setPosts((prev) => mergePosts(prev, loaded, postKey))
          });

          // IMPORTANT: In browsers, some public RPC endpoints fail due to CORS or rate limits.
          // We still want to show posts from any networks that *do* succeed.
          const settled = await Promise.allSettled(networkTasks);
          const fulfilled = settled.filter(
            (r): r is PromiseFulfilledResult<Post[]> => r.status === "fulfilled"
          );
          const rejected = settled.filter(
            (r): r is PromiseRejectedResult => r.status === "rejected"
          );

          const anyFulfilled = fulfilled.length > 0;
          if (!anyFulfilled && rejected.length > 0) {
            const warnSomeNetworksFailedToLoad = [
              // Best-effort diagnostics for dev; only warn when the whole feed fails.
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


          // Avoid status spam during background refreshes; only report initial load.
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
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, walletAddress, chainId, setStatus]
  );

  const hasAnyReadOnlyRpc = useMemo(() => {
    const env = import.meta.env as any;
    return [
      env.VITE_ETH_RPC_URL,
      env.VITE_ETH_SEPOLIA_RPC_URL,
      env.VITE_BASE_RPC_URL,
      env.VITE_BASE_SEPOLIA_RPC_URL,
      env.VITE_BSC_RPC_URL,
      env.VITE_BSC_TESTNET_RPC_URL,
      env.VITE_LOCAL_RPC_URL
    ].some((v) => typeof v === "string" && v.trim().length > 0);
  }, []);

  useEffect(() => {
    if (!provider && !hasAnyReadOnlyRpc) return;

    const isInitialEpoch = lastWalletEpochRef.current === -1;
    if (walletEpoch === lastWalletEpochRef.current) return;
    lastWalletEpochRef.current = walletEpoch;

    const walletAddressLower = walletAddress ? walletAddress.toLowerCase() : null;

    const chainChanged = lastChainIdRef.current !== chainId;
    const walletChanged = lastWalletAddressLowerRef.current !== walletAddressLower;

    // Some wallet implementations can emit multiple events (or bump an epoch)
    // without any observable chain/account changes. Avoid reloading in that case.
    if (!chainChanged && !walletChanged) return;
    lastChainIdRef.current = chainId;
    lastWalletAddressLowerRef.current = walletAddressLower;

    // UX requirement: the main feed is aggregated/read-only across networks and
    // should not reload just because the user's wallet switched chains.
    // Auto-refresh only on initial mount (load once) and wallet connect/disconnect.
    if (!walletChanged && !isInitialEpoch) return;

    void refreshFeed(walletAddress).catch(() => {
      // refreshFeed already reports status; avoid unhandled rejections
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
        // refreshFeed already reports status; avoid unhandled rejections
      });
    };

    const id = window.setInterval(refreshNow, 15_000);
    const onVisibility = () => {
      // When the tab becomes visible again, refresh promptly.
      if (document.visibilityState === "visible") refreshNow();
    };

    document.addEventListener?.("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener?.("visibilitychange", onVisibility);
    };
  }, [provider, walletAddress, refreshFeed, hasAnyReadOnlyRpc]);

  const value = useMemo<FeedContextValue>(
    () => ({
      posts,
      setPosts,
      isFeedLoading,
      refreshFeed,
      postComments,
      setPostComments,
      isLoadingPostComments,
      loadCommentsForPost,
      loadPostsByTokenIds
    }),
    [posts, isFeedLoading, refreshFeed, postComments, isLoadingPostComments, loadCommentsForPost, loadPostsByTokenIds]
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeed must be used within <FeedProvider>");
  return ctx;
}
