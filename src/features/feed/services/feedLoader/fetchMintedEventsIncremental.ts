import { withTimeout } from "@shared/lib/feedQuery";
import { parseFeedEventLogs } from "./parseFeedEventLogs";
import { queryAnyFeedEventsPaged } from "./queryAnyFeedEventsPaged";
import type { MintedEventLite, MintedEventsCache } from "../feedLoader";

export async function fetchMintedEventsIncremental(args: {
  chainLabel: string;
  chainCacheKey: string;
  maxLookbackBlocks: number;
  networkProvider: any;
  readContract: any;
  mintedEventsCache: MintedEventsCache;
}): Promise<{
  mintedEvents: MintedEventLite[];
  tokensNeedFullRefresh: Set<string>;
  tokensNeedCountersRefresh: Set<string>;
  burnedTokenIds: Set<string>;
}> {
  const latestAny = await withTimeout<any>(args.networkProvider.getBlockNumber(), 6_000, "feed getBlockNumber");
  const latest = Number(latestAny);
  if (!Number.isFinite(latest) || latest < 0) {
    throw new Error("Feed RPC returned invalid blockNumber.");
  }

  const windowSize = Math.min(25_000, args.maxLookbackBlocks, latest);
  const keepFromBlock = Math.max(0, latest - windowSize);

  const state = args.mintedEventsCache.get(args.chainCacheKey);

  const tokensNeedFullRefresh = new Set<string>();
  const tokensNeedCountersRefresh = new Set<string>();
  const burnedTokenIds = new Set<string>();

  // First time for this chain (or unknown chain): seed from window.
  if (!state || args.chainCacheKey === "?") {
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

    if (args.chainCacheKey !== "?") {
      args.mintedEventsCache.set(args.chainCacheKey, {
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
    const rawLogs = await queryAnyFeedEventsPaged({
      networkProvider: args.networkProvider,
      readContract: args.readContract,
      fromBlock: from,
      toBlock: latest,
      chainLabel: args.chainLabel
    });

    const parsed = parseFeedEventLogs({ readContract: args.readContract, rawLogs });
    const newMinted = parsed.mintedEvents;

    for (const id of parsed.tokensNeedFullRefresh) tokensNeedFullRefresh.add(id);
    for (const id of parsed.tokensNeedCountersRefresh) tokensNeedCountersRefresh.add(id);
    for (const id of parsed.burnedTokenIds) burnedTokenIds.add(id);

    state.events.push(...newMinted);
    state.lastScannedBlock = latest;
    state.events = state.events.filter((e) => (e.blockNumber ?? 0) >= keepFromBlock);
  }

  return { mintedEvents: state.events, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds };
}
