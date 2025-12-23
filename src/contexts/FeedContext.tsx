import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Post, PostComment } from "../types";
import { socialInterface } from "../contracts/socialPosts";
import { getErrorMessage } from "../lib/errors";
import { fetchTokenMetadata } from "../lib/metadata";
import { useContract } from "./ContractContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";

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

      const existing = new Set(posts.map((p) => p.tokenId));
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
        const byId = new Map(prev.map((p) => [p.tokenId, p] as const));
        for (const p of toAdd) byId.set(p.tokenId, p);
        return Array.from(byId.values());
      });
    },
    [provider, posts, ensureContractDeployedOnCurrentNetwork, getReadContract, walletAddress]
  );

  const refreshFeed = useCallback(
    async (accountOverride?: string | null) => {
      if (!provider) return;

      const account = typeof accountOverride === "string" ? accountOverride : walletAddress;
      if (refreshFeedInFlightRef.current) {
        await refreshFeedInFlightRef.current;
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
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();
          setStatus("Loading posts... (this can take a few seconds on testnets)");

          // Some RPC providers may fail when querying logs from block 0 to latest.
          // Fetch logs in an adaptive window.
          const fetchMintedEvents = async () => {
            const latest = await provider.getBlockNumber();

            let windowSize = 200_000;
            const maxWindowSize = Math.max(windowSize, latest);
            const minWindowSize = 2_000;

            while (true) {
              const fromBlock = Math.max(0, latest - windowSize);
              try {
                const events = await readContract.queryFilter(readContract.filters.PostMinted(), fromBlock, latest);
                if (events.length > 0 || fromBlock === 0) return events;

                if (windowSize >= maxWindowSize) return events;
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
                account ? ((readContract as any).hasLiked(tokenIdBig, account) as Promise<boolean>) : Promise.resolve(undefined),
                account ? ((readContract as any).hasShared(tokenIdBig, account) as Promise<boolean>) : Promise.resolve(undefined)
              ]);
            } catch {
              return null;
            }

            const tokenId = tokenIdBig.toString();
            const meta = await fetchTokenMetadata(tokenUri);

            const post: Post = {
              tokenId,
              title: meta?.name ?? `Token #${tokenId}`,
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

          setPosts(minted.filter((post): post is Post => post != null));
          setStatus("Feed loaded.");
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
      }
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, walletAddress, setStatus]
  );

  useEffect(() => {
    if (!provider) return;
    if (walletEpoch === lastWalletEpochRef.current) return;
    lastWalletEpochRef.current = walletEpoch;

    const chainChanged = lastChainIdRef.current !== chainId;
    const accountChanged = lastWalletAddressRef.current !== walletAddress;
    lastChainIdRef.current = chainId;
    lastWalletAddressRef.current = walletAddress;

    if (chainChanged) {
      setStatus("Network changed. Loading posts for the new network... (testnets can be slow)");
      setIsFeedLoading(true);
      setPosts([]);
      setPostComments({});
      setIsLoadingPostComments({});
    } else if (accountChanged) {
      setStatus(walletAddress ? "Wallet connected." : "Wallet disconnected");
    }

    void refreshFeed(walletAddress);
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
