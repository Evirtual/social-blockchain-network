import { withTimeout } from "@shared/lib/feedQuery";
import type { Post } from "@types";
import type { Block } from "ethers";
import type { ChainProvider } from "@features/contract";

export async function getMintTimestampIfNeeded(args: {
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
