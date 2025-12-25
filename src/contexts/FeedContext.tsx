import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import type { Post, PostComment } from "../types";
import { getSocialContract, socialInterface } from "../contracts/socialPosts";
import { getErrorMessage } from "../lib/errors";
import { fetchTokenMetadata } from "../lib/metadata";
import { useContract } from "./ContractContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";

type FeedNetworkConfig = {
  chainId: number;
  contractAddress: string;
  rpcUrl?: string;
};

function chainIdToNumber(chainId: string | null): number | null {
  if (!chainId) return null;
  if (chainId.startsWith("0x") || chainId.startsWith("0X")) {
    const n = Number.parseInt(chainId, 16);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number.parseInt(chainId, 10);
  return Number.isFinite(n) ? n : null;
}

function postKey(p: Pick<Post, "tokenId" | "chainId">) {
  return `${p.chainId ?? ""}:${p.tokenId}`;
}

export type FeedContextValue = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;

  isFeedLoading: boolean;
  refreshFeed: (accountOverride?: string | null) => Promise<void>;

  postComments: Record<string, PostComment[]>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
  isLoadingPostComments: Record<string, boolean>;
  loadCommentsForPost: (tokenId: string) => Promise<void>;

  loadPostsByTokenIds: (tokenIds: string[]) => Promise<void>;
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

  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [isLoadingPostComments, setIsLoadingPostComments] = useState<Record<string, boolean>>({});

  const refreshFeedInFlightRef = useRef<Promise<void> | null>(null);
  const queuedRefreshAccountRef = useRef<string | null | undefined>(undefined);
  const lastRefreshedAccountRef = useRef<string | null>(null);
  const commentsInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  // React to account/chain changes emitted by WalletContext.
  const lastWalletEpochRef = useRef<number>(-1);
  const lastChainIdRef = useRef<string | null>(null);
  const lastWalletAddressRef = useRef<string | null>(null);

  const loadCommentsForPost = useCallback(
    async (tokenId: string) => {
      if (!provider) return;

      const existingInFlight = commentsInFlightRef.current[tokenId];
      if (existingInFlight) {
        await existingInFlight;
        return;
      }

      const tokenIdBig = BigInt(tokenId);

      const task = (async () => {
        setIsLoadingPostComments((prev) => ({ ...prev, [tokenId]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();

          const filter = readContract.filters.PostCommented(null, tokenIdBig);
          const logs = await readContract.queryFilter(filter, 0, "latest");

          const parsed: PostComment[] = logs
            .flatMap((log: any) => {
              const desc = socialInterface.parseLog(log);
              if (!desc) return [];
              return [
                {
                  commenter: String(desc.args.commenter),
                  comment: String(desc.args.comment),
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber
                } satisfies PostComment
              ];
            })
            .sort((a: PostComment, b: PostComment) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));

          setPostComments((prev) => ({ ...prev, [tokenId]: parsed }));
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingPostComments((prev) => ({ ...prev, [tokenId]: false }));
        }
      })();

      commentsInFlightRef.current[tokenId] = task;
      try {
        await task;
      } finally {
        if (commentsInFlightRef.current[tokenId] === task) {
          commentsInFlightRef.current[tokenId] = null;
        }
      }
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, setStatus]
  );

  const loadPostsByTokenIds = useCallback(
    async (tokenIds: string[]) => {
      if (!provider) return;
      if (!tokenIds.length) return;

      const currentChainId = chainIdToNumber(chainId);
      const existing = new Set(
        posts
          .filter((p) => {
            const pChain = chainIdToNumber(p.chainId ?? null);
            return currentChainId == null || pChain == null || pChain === currentChainId;
          })
          .map((p) => p.tokenId)
      );
      const missing = Array.from(new Set(tokenIds)).filter((id) => id && !existing.has(id));
      if (missing.length === 0) return;

      await ensureContractDeployedOnCurrentNetwork();
      const readContract = await getReadContract();

      const mapWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
        const results: R[] = new Array(items.length);
        let nextIndex = 0;
        const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
          while (true) {
            const i = nextIndex++;
            if (i >= items.length) break;
            results[i] = await fn(items[i]);
          }
        });
        await Promise.all(workers);
        return results;
      };

      const fetched = await mapWithConcurrency(missing, 6, async (id) => {
        const tokenIdBig = BigInt(id);
        const exists = (await (readContract as any).exists(tokenIdBig)) as boolean;
        if (!exists) return null;

        let tokenUri = "";
        let likesRaw = 0n;
        let commentsRaw = 0n;
        let sharesRaw = 0n;
        let tipsWei = 0n;
        let author = "";
        let likedByMe: boolean | undefined;
        let repostedByMe: boolean | undefined;
        try {
          [tokenUri, likesRaw, commentsRaw, sharesRaw, tipsWei, author, likedByMe, repostedByMe] = await Promise.all([
            (readContract as any).tokenURI(tokenIdBig) as Promise<string>,
            (readContract as any).likesOf(tokenIdBig) as Promise<bigint>,
            (readContract as any).commentsOf(tokenIdBig) as Promise<bigint>,
            (readContract as any).sharesOf(tokenIdBig) as Promise<bigint>,
            (readContract as any).tipsOf(tokenIdBig) as Promise<bigint>,
            (readContract as any).authorOf(tokenIdBig) as Promise<string>,
            walletAddress ? ((readContract as any).hasLiked(tokenIdBig, walletAddress) as Promise<boolean>) : Promise.resolve(undefined),
            walletAddress ? ((readContract as any).hasShared(tokenIdBig, walletAddress) as Promise<boolean>) : Promise.resolve(undefined)
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
          shares: Number(sharesRaw),
          tipsWei,
          likedByMe,
          repostedByMe
        };
        return post;
      });

      const toAdd = fetched.filter((p): p is Post => p != null);
      if (toAdd.length === 0) return;

      setPosts((prev) => {
        const byId = new Map(prev.map((p) => [postKey(p), p] as const));
        for (const p of toAdd) byId.set(postKey(p), p);
        return Array.from(byId.values());
      });
    },
    [provider, posts, chainId, ensureContractDeployedOnCurrentNetwork, getReadContract, walletAddress]
  );

  const refreshFeed = useCallback(
    async (accountOverride?: string | null) => {
      const isVitest = typeof (globalThis as any).__vitest_worker__ !== "undefined";

      const account = typeof accountOverride === "string" ? accountOverride : walletAddress;
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

      const mapWithConcurrency = async <T, R>(
        items: T[],
        limit: number,
        fn: (item: T, index: number) => Promise<R>
      ): Promise<R[]> => {
        const results: R[] = new Array(items.length);
        let nextIndex = 0;
        const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
          while (true) {
            const i = nextIndex++;
            if (i >= items.length) break;
            results[i] = await fn(items[i], i);
          }
        });
        await Promise.all(workers);
        return results;
      };

      const task = (async () => {
        try {
          setIsFeedLoading(true);
          setStatus("Loading posts... (this can take a few seconds on testnets)");

          const currentChainIdNumber = chainIdToNumber(chainId);

          const env = import.meta.env as any;
          const configuredNetworks: FeedNetworkConfig[] = [
            { chainId: 1, contractAddress: env.VITE_CONTRACT_ADDRESS_ETH, rpcUrl: env.VITE_ETH_RPC_URL },
            { chainId: 11155111, contractAddress: env.VITE_CONTRACT_ADDRESS_SEPOLIA, rpcUrl: env.VITE_ETH_SEPOLIA_RPC_URL },
            { chainId: 8453, contractAddress: env.VITE_CONTRACT_ADDRESS_BASE, rpcUrl: env.VITE_BASE_RPC_URL },
            { chainId: 84532, contractAddress: env.VITE_CONTRACT_ADDRESS_BASE_SEPOLIA, rpcUrl: env.VITE_BASE_SEPOLIA_RPC_URL },
            { chainId: 56, contractAddress: env.VITE_CONTRACT_ADDRESS_BSC, rpcUrl: env.VITE_BSC_RPC_URL },
            { chainId: 97, contractAddress: env.VITE_CONTRACT_ADDRESS_BSC_TESTNET, rpcUrl: env.VITE_BSC_TESTNET_RPC_URL },
            {
              chainId: 31337,
              // Local dev commonly uses the legacy single-network address.
              contractAddress: env.VITE_CONTRACT_ADDRESS_LOCAL ?? env.VITE_CONTRACT_ADDRESS,
              rpcUrl: env.VITE_LOCAL_RPC_URL
            }
          ]
            .filter((n) => typeof n.contractAddress === "string" && n.contractAddress.trim().length > 0)
            .map((n) => ({ ...n, contractAddress: String(n.contractAddress).trim() }));

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

          const getNetworkTasks = async () => {
            // Current network uses the connected wallet provider to preserve existing behavior.
            const tasks: Array<Promise<Post[]>> = [];

            const loadFromProvider = async (
              chainIdNum: number | null,
              networkProvider: any,
              readContract: any
            ): Promise<Post[]> => {
              const queryPostMintedPaged = async (fromBlock: number, toBlock: number) => {
                const filter = readContract.filters.PostMinted();
                const logs: any[] = [];

                // Many public RPCs enforce limits on eth_getLogs response size and/or block range.
                // Paginate the query by block range and shrink chunk size on failure.
                let chunkSize = 5_000;
                const minChunkSize = 100;

                let start = fromBlock;
                while (start <= toBlock) {
                  const end = Math.min(toBlock, start + chunkSize - 1);
                  try {
                    const part = await readContract.queryFilter(filter, start, end);
                    logs.push(...part);
                    start = end + 1;
                  } catch (err) {
                    if (chunkSize <= minChunkSize) throw err;
                    chunkSize = Math.max(minChunkSize, Math.floor(chunkSize / 2));
                  }
                }

                return logs;
              };

              // Some RPC providers may fail when querying logs from block 0 to latest.
              // Fetch logs in an adaptive window.
              const fetchMintedEvents = async () => {
                const latest = await networkProvider.getBlockNumber();

                let windowSize = 50_000;
                const maxWindowSize = Math.max(windowSize, latest);
                const minWindowSize = 2_000;

                while (true) {
                  const fromBlock = Math.max(0, latest - windowSize);
                  try {
                    const events = await queryPostMintedPaged(fromBlock, latest);
                    if (events.length > 0 || fromBlock === 0) return events;

                    windowSize = Math.min(maxWindowSize, windowSize * 2);
                  } catch (err) {
                    if (windowSize <= minWindowSize) throw err;
                    windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
                  }
                }
              };

              const mintedEvents = await fetchMintedEvents();
              const eventsNewestFirst = mintedEvents.slice().reverse();

              const minted = await mapWithConcurrency(eventsNewestFirst, 6, async (event) => {
                const anyEvent = event as any;
                const args = anyEvent.args as any[] | undefined;
                const author = args?.[0] as string | undefined;
                const tokenIdBig = args?.[1] as bigint | undefined;
                if (!tokenIdBig) return null;

                const exists = (await readContract.exists(tokenIdBig)) as boolean;
                if (!exists) return null;

                const tokenId = tokenIdBig.toString();

                const blockNumber = Number(anyEvent.blockNumber ?? 0) || undefined;
                const txHash = (anyEvent.transactionHash as string | undefined) ?? undefined;

                let mintTimestamp: number | undefined;
                if (blockNumber && typeof networkProvider.getBlock === "function") {
                  try {
                    const block = await networkProvider.getBlock(blockNumber);
                    const ts = Number((block as any)?.timestamp ?? 0);
                    if (Number.isFinite(ts) && ts > 0) mintTimestamp = ts;
                  } catch {
                    // ignore
                  }
                }

                let tokenUri = "";
                let likesRaw = 0n;
                let commentsRaw = 0n;
                let sharesRaw = 0n;
                let tipsWei = 0n;
                let likedByMe: boolean | undefined;
                let repostedByMe: boolean | undefined;
                try {
                  [tokenUri, likesRaw, commentsRaw, sharesRaw, tipsWei, likedByMe, repostedByMe] = await Promise.all([
                    readContract.tokenURI(tokenIdBig) as Promise<string>,
                    readContract.likesOf(tokenIdBig) as Promise<bigint>,
                    readContract.commentsOf(tokenIdBig) as Promise<bigint>,
                    readContract.sharesOf(tokenIdBig) as Promise<bigint>,
                    readContract.tipsOf(tokenIdBig) as Promise<bigint>,
                    account
                      ? ((readContract as any).hasLiked(tokenIdBig, account) as Promise<boolean>)
                      : Promise.resolve(undefined),
                    account
                      ? ((readContract as any).hasShared(tokenIdBig, account) as Promise<boolean>)
                      : Promise.resolve(undefined)
                  ]);
                } catch {
                  return null;
                }

                const meta = await fetchTokenMetadata(tokenUri);

                const post: Post = {
                  tokenId,
                  chainId: chainIdNum != null ? String(chainIdNum) : undefined,
                  title: meta?.name ?? `Token #${tokenId}`,
                  body: meta?.description ?? "",
                  image: meta?.image ?? "",
                  animationUrl: meta?.animation_url,
                  metadataURI: tokenUri,
                  author,
                  mintTxHash: txHash,
                  mintBlockNumber: blockNumber,
                  mintTimestamp,
                  likes: Number(likesRaw),
                  comments: Number(commentsRaw),
                  shares: Number(sharesRaw),
                  tipsWei,
                  likedByMe,
                  repostedByMe
                };
                return post;
              });

              return minted.filter((p): p is Post => p != null);
            };

            // Current chain
            if (provider) {
              try {
                await ensureContractDeployedOnCurrentNetwork();
                const currentReadContract = await getReadContract();
                tasks.push(loadFromProvider(currentChainIdNumber, provider, currentReadContract));
              } catch {
                // If the connected network isn't configured, still try any configured read-only networks.
              }
            }

            // Other chains
            for (const cfg of extraNetworks) {
              const url = String(cfg.rpcUrl).trim();
              const rpcProvider: any = new ethers.JsonRpcProvider(url, cfg.chainId);
              const remoteReadContract = getSocialContract(cfg.contractAddress, rpcProvider);
              tasks.push(loadFromProvider(cfg.chainId, rpcProvider, remoteReadContract));
            }

            return tasks;
          };

          const networkTasks = await getNetworkTasks();

          // IMPORTANT: In browsers, some public RPC endpoints fail due to CORS or rate limits.
          // We still want to show posts from any networks that *do* succeed.
          const settled = await Promise.allSettled(networkTasks);
          const fulfilled = settled.filter(
            (r): r is PromiseFulfilledResult<Post[]> => r.status === "fulfilled"
          );
          const rejected = settled.filter(
            (r): r is PromiseRejectedResult => r.status === "rejected"
          );

          if (rejected.length > 0) {
            const warnSomeNetworksFailedToLoad = [
              // Best-effort diagnostics for dev; UI shows a generic hint below.
              // eslint-disable-next-line no-console
              console.warn.bind(console),
              () => {}
            ][Number(isVitest)];

            warnSomeNetworksFailedToLoad(
              "Some feed networks failed to load:",
              rejected.map((r) => r.reason)
            );
          }

          const merged = fulfilled.flatMap((r) => r.value);

          // If *everything* failed, surface the first error.
          if (merged.length === 0 && rejected.length > 0) {
            throw rejected[0].reason;
          }

          merged.sort((a, b) => {
            const at = a.mintTimestamp ?? 0;
            const bt = b.mintTimestamp ?? 0;
            if (at !== bt) return bt - at;
            const ab = a.mintBlockNumber ?? 0;
            const bb = b.mintBlockNumber ?? 0;
            if (ab !== bb) return bb - ab;
            return postKey(b).localeCompare(postKey(a));
          });

          // Deduplicate by (chainId, tokenId)
          const byKey = new Map<string, Post>();
          for (const p of merged) byKey.set(postKey(p), p);
          setPosts(Array.from(byKey.values()));

          setStatus(rejected.length > 0 ? "Feed loaded (some networks failed)." : "Feed loaded.");
        } catch (err) {
          setStatus(getErrorMessage(err));
          throw err;
        } finally {
          setIsFeedLoading(false);
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
      }
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, walletAddress, setStatus]
  );

  useEffect(() => {
    const env = import.meta.env as any;
    const hasAnyReadOnlyRpc =
      [
        env.VITE_ETH_RPC_URL,
        env.VITE_ETH_SEPOLIA_RPC_URL,
        env.VITE_BASE_RPC_URL,
        env.VITE_BASE_SEPOLIA_RPC_URL,
        env.VITE_BSC_RPC_URL,
        env.VITE_BSC_TESTNET_RPC_URL,
        env.VITE_LOCAL_RPC_URL
      ].some((v) => typeof v === "string" && v.trim().length > 0);

    if (!provider && !hasAnyReadOnlyRpc) return;
    if (walletEpoch === lastWalletEpochRef.current) return;
    lastWalletEpochRef.current = walletEpoch;

    const chainChanged = lastChainIdRef.current !== chainId;
    lastChainIdRef.current = chainId;
    lastWalletAddressRef.current = walletAddress;

    if (chainChanged) {
      setIsFeedLoading(true);
      setPosts([]);
      setPostComments({});
      setIsLoadingPostComments({});
    }

    void refreshFeed(walletAddress).catch(() => {
      // refreshFeed already reports status; avoid unhandled rejections
    });
  }, [provider, walletEpoch, chainId, walletAddress, refreshFeed, setStatus]);

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
