import { withTimeout } from "@shared/lib/feedQuery";
import type { BlockTimestampCache } from "../feedLoader";
import type { Post } from "@types";

export async function getMintTimestampIfNeeded(args: {
  needsFull: boolean;
  existing?: Post;
  eventBlockNumber?: number;
  networkProvider: any;
  chainCacheKey: string;
  blockTimestampCache: BlockTimestampCache;
}) {
  const blockNumber = Number(args.eventBlockNumber ?? 0) || undefined;
  if (!blockNumber) return undefined;
  if (!args.needsFull) return undefined;
  if (args.existing?.mintTimestamp != null) return undefined;
  if (typeof args.networkProvider.getBlock !== "function") return undefined;

  try {
    const chainCache = args.blockTimestampCache.get(args.chainCacheKey) ?? new Map<number, number>();
    if (!args.blockTimestampCache.has(args.chainCacheKey)) args.blockTimestampCache.set(args.chainCacheKey, chainCache);

    const cachedTs = chainCache.get(blockNumber);
    if (typeof cachedTs === "number" && cachedTs > 0) return cachedTs;

    const block = await withTimeout<any>(args.networkProvider.getBlock(blockNumber), 6_000, "feed getBlock");
    const ts = Number((block as any)?.timestamp ?? 0);
    if (Number.isFinite(ts) && ts > 0) {
      chainCache.set(blockNumber, ts);
      return ts;
    }
  } catch {
    // ignore
  }

  return undefined;
}
