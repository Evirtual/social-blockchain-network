import { mapWithConcurrency } from "@shared/lib/async";
import { queryLogsPagedRaw, withTimeout } from "@shared/lib/feedQuery";
import { fetchTokenMetadata } from "@features/metadata";
import type { Post } from "@types";
import { isAddress } from "ethers";
import type { Block, Contract, DeferredTopicFilter, EventLog, Log, TopicFilter } from "ethers";
import type { ChainProvider, SocialPostsContract } from "@features/contract";

export type MintedEventLite = {
  author?: string;
  tokenIdBig: bigint;
  blockNumber?: number;
  txHash?: string;
};

type RefreshTarget = {
  event: MintedEventLite;
  tokenId: string;
  tokenIdBig: bigint;
  chainIdStr: string | undefined;
  existing?: Post;
  needsFull: boolean;
  needsCounters: boolean;
};

export async function loadFeedFromProvider(args: {
  chainIdNum: number | null;
  networkProvider: ChainProvider;
  readContract: SocialPostsContract;
  maxLookbackBlocks: number;
  account: string | null;
  lastRefreshedAccount: string | null;
  postsSnapshot: Post[];
  postKey: (p: Pick<Post, "tokenId" | "chainId">) => string;
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
    pruneByKeys
  } = args;

  const resolvedChainIdNum = await resolveChainIdNum({ chainIdNum, networkProvider });

  const chainCacheKey = String(resolvedChainIdNum ?? chainIdNum ?? "?");
  const chainLabel = String(resolvedChainIdNum ?? chainIdNum ?? "?");

  const accountChanged = (account ?? null) !== lastRefreshedAccount;

  const { mintedEvents, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds } =
    await fetchMintedEventsIncremental({
      chainLabel,
      chainCacheKey,
      maxLookbackBlocks,
      networkProvider,
      readContract
    });

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
  await pruneExistsFallback({
    resolvedChainIdNum,
    postsSnapshot,
    postKey,
    pruneByKeys,
    readContract
  });

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

  const minted = await loadRefreshTargets({
    refreshTargets,
    readContract,
    resolvedChainIdNum,
    chainCacheKey,
    chainIdNum,
    networkProvider,
    account
  });

  return minted.filter((p): p is Post => p != null);
}

async function resolveChainIdNum(args: { chainIdNum: number | null; networkProvider: ChainProvider }) {
  let resolvedChainIdNum: number | null = args.chainIdNum;
  if (resolvedChainIdNum == null && typeof args.networkProvider?.getNetwork === "function") {
    try {
      const net = await withTimeout(args.networkProvider.getNetwork(), 3_000, "feed getNetwork");
      const n = Number(net?.chainId);
      resolvedChainIdNum = Number.isFinite(n) ? n : null;
    } catch {
      resolvedChainIdNum = null;
    }
  }
  return resolvedChainIdNum;
}

async function fetchMintedEventsIncremental(args: {
  chainLabel: string;
  chainCacheKey: string;
  maxLookbackBlocks: number;
  networkProvider: ChainProvider;
  readContract: SocialPostsContract;
}): Promise<{
  mintedEvents: MintedEventLite[];
  tokensNeedFullRefresh: Set<string>;
  tokensNeedCountersRefresh: Set<string>;
  burnedTokenIds: Set<string>;
}> {
  void args.chainCacheKey;
  const latest = await withTimeout(args.networkProvider.getBlockNumber(), 6_000, "feed getBlockNumber");
  if (!Number.isFinite(latest) || latest < 0) {
    throw new Error("Feed RPC returned invalid blockNumber.");
  }

  const windowSize = Math.min(25_000, args.maxLookbackBlocks, latest);
  const keepFromBlock = Math.max(0, latest - windowSize);

  const tokensNeedFullRefresh = new Set<string>();
  const tokensNeedCountersRefresh = new Set<string>();
  const burnedTokenIds = new Set<string>();

  const rawLogs = await queryAnyFeedEventsPaged({
    networkProvider: args.networkProvider,
    readContract: args.readContract,
    fromBlock: keepFromBlock,
    toBlock: latest,
    chainLabel: args.chainLabel
  });
  const parsed = parseFeedEventLogs({ readContract: args.readContract, rawLogs });
  const minted = parsed.mintedEvents;

  for (const id of parsed.tokensNeedFullRefresh) tokensNeedFullRefresh.add(id);
  for (const id of parsed.tokensNeedCountersRefresh) tokensNeedCountersRefresh.add(id);
  for (const id of parsed.burnedTokenIds) burnedTokenIds.add(id);

  return { mintedEvents: minted, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds };
}

async function pruneExistsFallback(args: {
  resolvedChainIdNum: number | null;
  postsSnapshot: Post[];
  postKey: (p: Pick<Post, "tokenId" | "chainId">) => string;
  pruneByKeys: (keys: Set<string>) => void;
  readContract: SocialPostsContract;
}) {
  if (args.resolvedChainIdNum == null) return;

  const chainIdStr = String(args.resolvedChainIdNum);
  const chainPosts = args.postsSnapshot.filter((p) => p.chainId === chainIdStr);
  const batchSize = 10;
  const sample = chainPosts.slice(0, batchSize);

  if (sample.length === 0) return;

  const dead = await mapWithConcurrency(sample, 5, async (p) => {
    try {
      const ok = (await args.readContract.exists(BigInt(p.tokenId))) as boolean;
      return ok ? null : p;
    } catch {
      return null;
    }
  });

  const deadKeys = new Set(dead.filter(Boolean).map((p) => args.postKey(p as Post)));
  if (deadKeys.size > 0) args.pruneByKeys(deadKeys);
}

async function loadRefreshTargets(args: {
  refreshTargets: RefreshTarget[];
  readContract: SocialPostsContract;
  resolvedChainIdNum: number | null;
  chainCacheKey: string;
  chainIdNum: number | null;
  networkProvider: ChainProvider;
  account: string | null;
}) {
  void args.chainCacheKey;
  void args.chainIdNum;
  return await mapWithConcurrency<RefreshTarget, Post | null>(args.refreshTargets, 6, async (t) => {
    const author = t.event.author;
    const tokenIdBig = t.tokenIdBig;
    const tokenId = t.tokenId;
    const existing = t.existing;

    const blockNumber = Number(t.event.blockNumber ?? 0) || undefined;
    const txHash = (t.event.txHash as string | undefined) ?? undefined;

    const mintTimestamp = await getMintTimestampIfNeeded({
      needsFull: t.needsFull,
      existing,
      eventBlockNumber: t.event.blockNumber,
      networkProvider: args.networkProvider
    });

    let likesRaw = 0n;
    let commentsRaw = 0n;
    let savesRaw = 0n;
    let tipsWei = 0n;
    let likedByMe: boolean | undefined;
    let savedByMe: boolean | undefined;
    try {
      [likesRaw, commentsRaw, savesRaw, tipsWei, likedByMe, savedByMe] = await Promise.all([
        args.readContract.likesOf(tokenIdBig) as Promise<bigint>,
        args.readContract.commentsOf(tokenIdBig) as Promise<bigint>,
        args.readContract.savesOf(tokenIdBig) as Promise<bigint>,
        args.readContract.tipsOf(tokenIdBig) as Promise<bigint>,
        args.account
          ? (args.readContract.hasLiked(tokenIdBig, args.account) as Promise<boolean>)
          : Promise.resolve(undefined),
        args.account
          ? (args.readContract.hasSaved(tokenIdBig, args.account) as Promise<boolean>)
          : Promise.resolve(undefined)
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
      tokenUri = (await args.readContract.tokenURI(tokenIdBig)) as string;
    } catch {
      return null;
    }

    const meta = await fetchTokenMetadata(tokenUri);

    return {
      tokenId,
      chainId: args.resolvedChainIdNum != null ? String(args.resolvedChainIdNum) : undefined,
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
}

async function getMintTimestampIfNeeded(args: {
  needsFull: boolean;
  existing?: Post;
  eventBlockNumber?: number;
  networkProvider: ChainProvider;
}) {
  const blockNumber = Number(args.eventBlockNumber ?? 0) || undefined;
  if (!blockNumber) return undefined;
  if (!args.needsFull) return undefined;
  if (args.existing?.mintTimestamp != null) return undefined;
  if (typeof args.networkProvider.getBlock !== "function") return undefined;

  try {
    const block = (await withTimeout(args.networkProvider.getBlock(blockNumber), 6_000, "feed getBlock")) as Block | null;
    const ts = Number(block?.timestamp ?? 0);
    if (Number.isFinite(ts) && ts > 0) {
      return ts;
    }
  } catch {
    // ignore
  }

  return undefined;
}

function getContractAddress(readContract: Contract): string {
  const addr = readContract?.target ?? readContract?.address;
  return String(addr ?? "");
}

type FeedLog = EventLog | Log;

function parseFeedEventLogs(args: { readContract: Contract; rawLogs: FeedLog[] }) {
  const tokensNeedFullRefresh = new Set<string>();
  const tokensNeedCountersRefresh = new Set<string>();
  const burnedTokenIds = new Set<string>();

  const mintedEvents: MintedEventLite[] = [];

  for (const log of args.rawLogs) {
    const desc = args.readContract.interface?.parseLog ? args.readContract.interface.parseLog(log) : null;
    if (!desc) continue;
    const name = String(desc.name ?? "");
    const parsedArgs = desc.args as Array<string | bigint | number | boolean | null | undefined> | undefined;
    if (!parsedArgs) continue;

    const tokenIdAt = (index: number): bigint | undefined => {
      const v = parsedArgs[index];
      return typeof v === "bigint" ? v : undefined;
    };

    if (name === "PostMinted") {
      const author = parsedArgs[0] as string | undefined;
      if (author && !isAddress(author)) {
        // If the contract emitted something unexpected, ignore.
      }
      const tokenIdBig = tokenIdAt(1);
      if (!tokenIdBig) continue;
      tokensNeedFullRefresh.add(tokenIdBig.toString());
      mintedEvents.push({
        author,
        tokenIdBig,
        blockNumber: typeof log.blockNumber === "number" ? log.blockNumber : Number(log.blockNumber ?? 0) || undefined,
        txHash: log.transactionHash ?? undefined
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
    if (
      name === "PostLiked" ||
      name === "PostUnliked" ||
      name === "PostSaved" ||
      name === "PostUnsaved" ||
      name === "CommentAdded" ||
      name === "CommentDeleted"
    ) {
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

  return { mintedEvents, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds };
}

async function queryAnyFeedEventsPaged(args: {
  networkProvider: ChainProvider;
  readContract: SocialPostsContract;
  fromBlock: number;
  toBlock: number;
  chainLabel: string;
}) {
  const topics0 = await buildFeedTopics0(args.readContract);
  const address = getContractAddress(args.readContract);
  if (!address) return [];

  return await queryLogsPagedRaw({
    provider: args.networkProvider,
    address,
    topics: [topics0],
    fromBlock: args.fromBlock,
    toBlock: args.toBlock,
    label: `feed events ${args.chainLabel}`
  });
}


type FilterWithTopics = { topics?: ReadonlyArray<string | string[] | null> };
type FilterLike = DeferredTopicFilter | TopicFilter | FilterWithTopics;

async function resolveTopics(filter: FilterLike): Promise<ReadonlyArray<string | string[] | null>> {
  if (Array.isArray(filter)) return filter;
  if ("getTopicFilter" in filter) {
    const resolved = await filter.getTopicFilter();
    return resolved ?? [];
  }
  const topics = (filter as { topics?: ReadonlyArray<string | string[] | null> }).topics;
  return topics ?? [];
}

async function buildFeedTopics0(readContract: Contract): Promise<string[]> {
  const getEventTopic0 = async (filter: FilterLike): Promise<string | null> => {
    const topics = await resolveTopics(filter);
    const topic0 = topics[0] ?? null;
    return typeof topic0 === "string" && topic0.length > 0 ? topic0 : null;
  };

  const topics0 = Array.from(
    new Set(
      (await Promise.all([
        getEventTopic0(readContract.filters.PostMinted()),
        getEventTopic0(readContract.filters.PostUpdated()),
        getEventTopic0(readContract.filters.PostUpdatedByAdmin()),
        getEventTopic0(readContract.filters.PostBurned()),
        getEventTopic0(readContract.filters.PostBurnedByAdmin()),
        getEventTopic0(readContract.filters.PostLiked()),
        getEventTopic0(readContract.filters.PostUnliked()),
        getEventTopic0(readContract.filters.CommentAdded()),
        getEventTopic0(readContract.filters.CommentDeleted()),
        getEventTopic0(readContract.filters.PostSaved()),
        getEventTopic0(readContract.filters.PostUnsaved()),
        getEventTopic0(readContract.filters.PostTipped())
      ])).filter((x): x is string => !!x)
    )
  );

  return topics0;
}
