import type { Post } from "../types";
import { mapWithConcurrency } from "./async";
import { withTimeout, queryLogsPagedRaw } from "./feedQuery";
import { fetchTokenMetadata } from "./metadata";

export type MintedEventLite = {
  author?: string;
  tokenIdBig: bigint;
  blockNumber?: number;
  txHash?: string;
};

export type MintedEventsCache = Map<string, { lastScannedBlock: number; events: MintedEventLite[] }>;
export type BlockTimestampCache = Map<string, Map<number, number>>;
export type ExistsPruneCursor = Map<string, number>;

export async function loadFeedFromProvider(args: {
  chainIdNum: number | null;
  networkProvider: any;
  readContract: any;
  maxLookbackBlocks: number;
  account: string | null;
  lastRefreshedAccount: string | null;
  postsSnapshot: Post[];
  postKey: (p: Pick<Post, "tokenId" | "chainId">) => string;
  mintedEventsCache: MintedEventsCache;
  blockTimestampCache: BlockTimestampCache;
  existsPruneCursor: ExistsPruneCursor;
  pruneByKeys: (keys: Set<string>) => void;
}): Promise<Post[]> {
  const {
    chainIdNum,
    networkProvider,
    readContract,
    maxLookbackBlocks,
    account,
    lastRefreshedAccount,
    postsSnapshot,
    postKey,
    mintedEventsCache,
    blockTimestampCache,
    existsPruneCursor,
    pruneByKeys
  } = args;

  let resolvedChainIdNum: number | null = chainIdNum;
  if (resolvedChainIdNum == null && typeof networkProvider?.getNetwork === "function") {
    try {
      const net = await withTimeout(networkProvider.getNetwork(), 3_000, "feed getNetwork");
      const n = Number((net as any)?.chainId);
      resolvedChainIdNum = Number.isFinite(n) ? n : null;
    } catch {
      resolvedChainIdNum = null;
    }
  }

  const getContractAddress = (): string => {
    const addr = (readContract as any)?.target ?? (readContract as any)?.address;
    return String(addr ?? "");
  };

  const getEventTopic0 = (filter: any): string | null => {
    const topic0 = filter?.topics?.[0] ?? null;
    return typeof topic0 === "string" && topic0.length > 0 ? topic0 : null;
  };

  const queryAnyFeedEventsPaged = async (fromBlock: number, toBlock: number) => {
    const topics0 = Array.from(
      new Set(
        [
          getEventTopic0(readContract.filters.PostMinted()),
          getEventTopic0(readContract.filters.PostUpdated()),
          getEventTopic0(readContract.filters.PostUpdatedByAdmin()),
          getEventTopic0(readContract.filters.PostBurned()),
          getEventTopic0(readContract.filters.PostBurnedByAdmin()),
          getEventTopic0(readContract.filters.PostLiked()),
          getEventTopic0(readContract.filters.PostUnliked()),
          getEventTopic0(readContract.filters.PostCommented()),
          getEventTopic0(readContract.filters.PostSaved()),
          getEventTopic0(readContract.filters.PostUnsaved()),
          getEventTopic0(readContract.filters.PostTipped())
        ].filter((x): x is string => !!x)
      )
    );

    const address = getContractAddress();
    if (!address) return [];

    return await queryLogsPagedRaw({
      provider: networkProvider,
      address,
      topics: [topics0],
      fromBlock,
      toBlock,
      label: `feed events ${resolvedChainIdNum ?? chainIdNum ?? "?"}`
    });
  };

  const fetchMintedEventsIncremental = async (): Promise<{
    mintedEvents: MintedEventLite[];
    tokensNeedFullRefresh: Set<string>;
    tokensNeedCountersRefresh: Set<string>;
    burnedTokenIds: Set<string>;
  }> => {
    const latestAny = await withTimeout<any>(networkProvider.getBlockNumber(), 6_000, "feed getBlockNumber");
    const latest = Number(latestAny);
    if (!Number.isFinite(latest) || latest < 0) {
      throw new Error("Feed RPC returned invalid blockNumber.");
    }

    // Mirror previous behavior: scan within a capped recent window.
    const windowSize = Math.min(25_000, maxLookbackBlocks, latest);
    const keepFromBlock = Math.max(0, latest - windowSize);

    const cacheKey = String(resolvedChainIdNum ?? chainIdNum ?? "?");
    const state = mintedEventsCache.get(cacheKey);

    const tokensNeedFullRefresh = new Set<string>();
    const tokensNeedCountersRefresh = new Set<string>();
    const burnedTokenIds = new Set<string>();

    const parseBatchLogs = (rawLogs: any[]) => {
      const minted: MintedEventLite[] = [];

      for (const log of rawLogs) {
        const desc = readContract.interface?.parseLog
          ? readContract.interface.parseLog(log)
          : null;
        if (!desc) continue;
        const name = String((desc as any).name ?? "");
        const args = (desc as any).args as any[] | undefined;
        if (!args) continue;

        const tokenIdAt = (index: number): bigint | undefined => {
          const v = args[index] as bigint | undefined;
          return typeof v === "bigint" ? v : undefined;
        };

        if (name === "PostMinted") {
          const author = args[0] as string | undefined;
          const tokenIdBig = tokenIdAt(1);
          if (!tokenIdBig) continue;
          tokensNeedFullRefresh.add(tokenIdBig.toString());
          minted.push({
            author,
            tokenIdBig,
            blockNumber:
              typeof (log as any)?.blockNumber === "number"
                ? (log as any).blockNumber
                : Number((log as any)?.blockNumber ?? 0) || undefined,
            txHash: ((log as any)?.transactionHash as string | undefined) ?? undefined
          } satisfies MintedEventLite);
          continue;
        }

        // tokenId indices mirror the previous per-event query logic.
        if (name === "PostUpdated") {
          const tokenIdBig = tokenIdAt(1);
          if (tokenIdBig) tokensNeedFullRefresh.add(tokenIdBig.toString());
          continue;
        }
        if (name === "PostUpdatedByAdmin") {
          const tokenIdBig = tokenIdAt(2);
          if (tokenIdBig) tokensNeedFullRefresh.add(tokenIdBig.toString());
          continue;
        }
        if (name === "PostBurned") {
          const tokenIdBig = tokenIdAt(1);
          if (tokenIdBig) burnedTokenIds.add(tokenIdBig.toString());
          continue;
        }
        if (name === "PostBurnedByAdmin") {
          const tokenIdBig = tokenIdAt(2);
          if (tokenIdBig) burnedTokenIds.add(tokenIdBig.toString());
          continue;
        }
        if (name === "PostLiked" || name === "PostUnliked" || name === "PostCommented" || name === "PostSaved" || name === "PostUnsaved") {
          const tokenIdBig = tokenIdAt(1);
          if (tokenIdBig) tokensNeedCountersRefresh.add(tokenIdBig.toString());
          continue;
        }
        if (name === "PostTipped") {
          const tokenIdBig = tokenIdAt(2);
          if (tokenIdBig) tokensNeedCountersRefresh.add(tokenIdBig.toString());
          continue;
        }
      }

      return minted;
    };

    // First time for this chain (or unknown chain): seed from window.
    if (!state || cacheKey === "?") {
      const rawLogs = await queryAnyFeedEventsPaged(keepFromBlock, latest);
      const minted = parseBatchLogs(rawLogs);

      if (cacheKey !== "?") {
        mintedEventsCache.set(cacheKey, {
          lastScannedBlock: latest,
          events: minted.filter((e) => (e.blockNumber ?? 0) >= keepFromBlock)
        });
      }

      return { mintedEvents: minted, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds };
    }

    // Trim if our cached history drifts outside the window.
    state.events = state.events.filter((e) => (e.blockNumber ?? 0) >= keepFromBlock);

    // If we somehow fell behind the keep window (e.g. very long-running tab), reset to window.
    if (state.lastScannedBlock < keepFromBlock) {
      state.lastScannedBlock = keepFromBlock - 1;
      state.events = [];
    }

    if (state.lastScannedBlock < latest) {
      const from = Math.max(keepFromBlock, state.lastScannedBlock + 1);
      const rawLogs = await queryAnyFeedEventsPaged(from, latest);
      const newMinted = parseBatchLogs(rawLogs);
      state.events.push(...newMinted);

      state.lastScannedBlock = latest;
      state.events = state.events.filter((e) => (e.blockNumber ?? 0) >= keepFromBlock);
    }

    return { mintedEvents: state.events, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds };
  };

  const accountChanged = (account ?? null) !== lastRefreshedAccount;

  const { mintedEvents, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds } =
    await fetchMintedEventsIncremental();

  if (accountChanged && resolvedChainIdNum != null) {
    const chainIdStr = String(resolvedChainIdNum);
    for (const p of postsSnapshot) {
      if (p.chainId === chainIdStr) tokensNeedCountersRefresh.add(p.tokenId);
    }
  }

  if (burnedTokenIds.size > 0 && resolvedChainIdNum != null) {
    const chainIdStr = String(resolvedChainIdNum);
    const burnedKeys = new Set(Array.from(burnedTokenIds).map((id) => `${chainIdStr}:${id}`));
    pruneByKeys(burnedKeys);
  }

  const eventsNewestFirst = mintedEvents.slice().reverse();
  const existingByKey = new Map(postsSnapshot.map((p) => [postKey(p), p] as const));

  // Lightweight pruning fallback if burn logs were missed.
  if (resolvedChainIdNum != null) {
    const chainIdStr = String(resolvedChainIdNum);
    const chainPosts = postsSnapshot.filter((p) => p.chainId === chainIdStr);
    const cursor = existsPruneCursor.get(chainIdStr) ?? 0;
    const batchSize = 10;
    const sample = chainPosts.slice(cursor, cursor + batchSize);
    existsPruneCursor.set(chainIdStr, (cursor + batchSize) % Math.max(1, chainPosts.length));
    if (sample.length > 0) {
      const dead = await mapWithConcurrency(sample, 5, async (p) => {
        try {
          const ok = (await (readContract as any).exists(BigInt(p.tokenId))) as boolean;
          return ok ? null : p;
        } catch {
          return null;
        }
      });
      const deadKeys = new Set(dead.filter(Boolean).map((p) => postKey(p as Post)));
      if (deadKeys.size > 0) pruneByKeys(deadKeys);
    }
  }

  type RefreshTarget = {
    event: MintedEventLite;
    tokenId: string;
    tokenIdBig: bigint;
    chainIdStr: string | undefined;
    existing?: Post;
    needsFull: boolean;
    needsCounters: boolean;
  };

  const chainIdStr = resolvedChainIdNum != null ? String(resolvedChainIdNum) : undefined;
  const refreshTargets: RefreshTarget[] = [];
  for (const event of eventsNewestFirst) {
    const tokenId = event.tokenIdBig.toString();
    const key = chainIdStr ? `${chainIdStr}:${tokenId}` : undefined;
    const existing = key ? existingByKey.get(key) : undefined;

    const needsFull = tokensNeedFullRefresh.has(tokenId) || !existing;
    const needsCounters = tokensNeedCountersRefresh.has(tokenId);

    if (existing && !needsFull && !needsCounters) continue;
    if (burnedTokenIds.has(tokenId)) continue;

    refreshTargets.push({
      event,
      tokenId,
      tokenIdBig: event.tokenIdBig,
      chainIdStr,
      existing,
      needsFull,
      needsCounters
    });
  }

  const getMintTimestampIfNeeded = async (target: RefreshTarget): Promise<number | undefined> => {
    const existing = target.existing;
    const blockNumber = Number(target.event.blockNumber ?? 0) || undefined;
    if (!blockNumber) return undefined;
    if (!target.needsFull) return undefined;
    if (existing?.mintTimestamp != null) return undefined;
    if (typeof networkProvider.getBlock !== "function") return undefined;

    try {
      const tsCacheKey = String(resolvedChainIdNum ?? chainIdNum ?? "?");
      const chainCache = blockTimestampCache.get(tsCacheKey) ?? new Map<number, number>();
      if (!blockTimestampCache.has(tsCacheKey)) blockTimestampCache.set(tsCacheKey, chainCache);

      const cachedTs = chainCache.get(blockNumber);
      if (typeof cachedTs === "number" && cachedTs > 0) return cachedTs;

      const block = await withTimeout<any>(networkProvider.getBlock(blockNumber), 6_000, "feed getBlock");
      const ts = Number((block as any)?.timestamp ?? 0);
      if (Number.isFinite(ts) && ts > 0) {
        chainCache.set(blockNumber, ts);
        return ts;
      }
    } catch {
      // ignore
    }

    return undefined;
  };

  const minted = await (async () => {
    // Individual calls per token (avoids redundant exists() pre-check).
    return await mapWithConcurrency<RefreshTarget, Post | null>(refreshTargets, 6, async (t) => {
      const author = t.event.author;
      const tokenIdBig = t.tokenIdBig;
      const tokenId = t.tokenId;
      const existing = t.existing;

      const blockNumber = Number(t.event.blockNumber ?? 0) || undefined;
      const txHash = (t.event.txHash as string | undefined) ?? undefined;

      const mintTimestamp = await getMintTimestampIfNeeded(t);

      let likesRaw = 0n;
      let commentsRaw = 0n;
      let savesRaw = 0n;
      let tipsWei = 0n;
      let likedByMe: boolean | undefined;
      let savedByMe: boolean | undefined;
      try {
        [likesRaw, commentsRaw, savesRaw, tipsWei, likedByMe, savedByMe] = await Promise.all([
          readContract.likesOf(tokenIdBig) as Promise<bigint>,
          readContract.commentsOf(tokenIdBig) as Promise<bigint>,
          readContract.savesOf(tokenIdBig) as Promise<bigint>,
          readContract.tipsOf(tokenIdBig) as Promise<bigint>,
          account ? ((readContract as any).hasLiked(tokenIdBig, account) as Promise<boolean>) : Promise.resolve(undefined),
          account ? ((readContract as any).hasSaved(tokenIdBig, account) as Promise<boolean>) : Promise.resolve(undefined)
        ]);
      } catch {
        return null;
      }

      if (existing && !t.needsFull) {
        return {
          ...existing,
          likes: Number(likesRaw),
          comments: Number(commentsRaw),
          saves: Number(savesRaw),
          tipsWei,
          likedByMe,
          savedByMe
        } satisfies Post;
      }

      let tokenUri = "";
      try {
        tokenUri = (await readContract.tokenURI(tokenIdBig)) as string;
      } catch {
        return null;
      }

      const meta = await fetchTokenMetadata(tokenUri);

      return {
        tokenId,
        chainId: resolvedChainIdNum != null ? String(resolvedChainIdNum) : undefined,
        title: meta?.name ?? `Token #${tokenId}`,
        body: meta?.description ?? "",
        image: meta?.image ?? "",
        animationUrl: meta?.animation_url,
        metadataURI: tokenUri,
        author: existing?.author ?? author,
        mintTxHash: existing?.mintTxHash ?? txHash,
        mintBlockNumber: existing?.mintBlockNumber ?? blockNumber,
        mintTimestamp: existing?.mintTimestamp ?? mintTimestamp,
        likes: Number(likesRaw),
        comments: Number(commentsRaw),
        saves: Number(savesRaw),
        tipsWei,
        likedByMe,
        savedByMe
      } satisfies Post;
    });
  })();

  return minted.filter((p): p is Post => p != null);
}
