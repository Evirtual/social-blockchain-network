import type { Interface, LogDescription } from "ethers";
import { withTimeout } from "./feedQuery";

function getLogOrderIndex(log: any): number {
  const idx = (log as any)?.index ?? (log as any)?.logIndex;
  const n = Number(idx ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type ScanFollowToggleArgs = {
  readContract: any;
  scanProvider: any;
  iface: Interface;

  followedFilter: any;
  unfollowedFilter: any;

  addressArgIndex: number;

  maxRounds?: number;
  maxEvents?: number;
  initialWindowSize?: number;
  minWindowSize?: number;
  errorLabel?: string;
  timeoutMs?: number;
};

export async function scanActiveFollowAddresses(args: ScanFollowToggleArgs): Promise<string[]> {
  const {
    readContract,
    scanProvider,
    iface,
    followedFilter,
    unfollowedFilter,
    addressArgIndex,
    maxRounds = 60,
    maxEvents = 7_500,
    initialWindowSize = 75_000,
    minWindowSize = 2_000,
    errorLabel = "follow",
    timeoutMs = 8_000
  } = args;

  const latestRaw = await withTimeout(scanProvider?.getBlockNumber?.() ?? Promise.resolve(0), timeoutMs, "follow scan getBlockNumber");
  const latest = Number(latestRaw);
  if (!Number.isFinite(latest) || latest < 0) {
    throw new Error("RPC returned an invalid block number.");
  }

  let windowSize = initialWindowSize;
  const collected: any[] = [];

  const pullRange = async (fromBlock: number, toBlock: number) => {
    const [followed, unfollowed] = await Promise.all([
      withTimeout(
        (readContract as any).queryFilter(followedFilter, fromBlock, toBlock),
        timeoutMs,
        `follow scan Followed ${fromBlock}-${toBlock}`
      ),
      withTimeout(
        (readContract as any).queryFilter(unfollowedFilter, fromBlock, toBlock),
        timeoutMs,
        `follow scan Unfollowed ${fromBlock}-${toBlock}`
      )
    ]);

    const all = [...(followed as any[]), ...(unfollowed as any[])];
    return all.sort((a, b) => {
      const ab = Number((a as any).blockNumber ?? 0);
      const bb = Number((b as any).blockNumber ?? 0);
      if (ab !== bb) return ab - bb;
      return getLogOrderIndex(a) - getLogOrderIndex(b);
    });
  };

  let end = latest;
  for (let round = 0; round < maxRounds && end >= 0 && collected.length < maxEvents; round++) {
    const start = Math.max(0, end - windowSize);
    try {
      const logs = await pullRange(start, end);
      collected.unshift(...logs);
      if (start === 0) break;
      end = start - 1;
    } catch {
      if (windowSize <= minWindowSize) throw new Error(`RPC could not serve ${errorLabel} log range.`);
      windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
    }
  }

  const state = new Map<string, { active: boolean; lastBlock: number; lastIndex: number }>();
  for (const log of collected) {
    let parsed: LogDescription | null = null;
    try {
      parsed = iface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
    } catch {
      parsed = null;
    }
    if (!parsed) continue;

    const addr = (parsed.args?.[addressArgIndex] as string | undefined) ?? "";
    if (!addr) continue;

    const key = addr.toLowerCase();
    const blockNumber = Number((log as any).blockNumber ?? 0);
    const logIndex = getLogOrderIndex(log);

    if (parsed.name === "Followed") {
      state.set(key, { active: true, lastBlock: blockNumber, lastIndex: logIndex });
    } else if (parsed.name === "Unfollowed") {
      state.set(key, { active: false, lastBlock: blockNumber, lastIndex: logIndex });
    }
  }

  return Array.from(state.entries())
    .filter(([, v]) => v.active)
    .sort((a, b) => {
      const db = b[1].lastBlock - a[1].lastBlock;
      if (db !== 0) return db;
      return b[1].lastIndex - a[1].lastIndex;
    })
    .map(([addr]) => addr);
}
