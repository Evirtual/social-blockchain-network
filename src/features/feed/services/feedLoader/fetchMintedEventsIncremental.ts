import { withTimeout } from "@shared/lib/feedQuery";
import { parseFeedEventLogs } from "./parseFeedEventLogs";
import { queryAnyFeedEventsPaged } from "./queryAnyFeedEventsPaged";
import type { MintedEventLite } from "../feedLoader";

export async function fetchMintedEventsIncremental(args: {
  chainLabel: string;
  chainCacheKey: string;
  maxLookbackBlocks: number;
  networkProvider: any;
  readContract: any;
}): Promise<{
  mintedEvents: MintedEventLite[];
  tokensNeedFullRefresh: Set<string>;
  tokensNeedCountersRefresh: Set<string>;
  burnedTokenIds: Set<string>;
}> {
  void args.chainCacheKey;
  const latestAny = await withTimeout<any>(args.networkProvider.getBlockNumber(), 6_000, "feed getBlockNumber");
  const latest = Number(latestAny);
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
