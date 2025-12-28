import type { Interface, LogDescription } from "ethers";
import { withTimeout } from "./feedQuery";

function getLogOrderIndex(log: any): number {
  const idx = (log as any)?.index ?? (log as any)?.logIndex;
  const n = Number(idx ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type ToggleScanArgs = {
  readContract: any;
  scanProvider: any;
  iface: Interface;

  address: string;
  onFilter: any;
  offFilter: any;
  onEventName: string;
  offEventName: string;

  tokenIdArgIndex: number;

  maxRounds?: number;
  maxEvents?: number;
  initialWindowSize?: number;
  minWindowSize?: number;
  timeoutMs?: number;
};

export async function scanToggleEventsForAddress(args: ToggleScanArgs): Promise<string[]> {
  const {
    readContract,
    scanProvider,
    iface,
    address,
    onFilter,
    offFilter,
    onEventName,
    offEventName,
    tokenIdArgIndex,
    maxRounds = 60,
    maxEvents = 5_000,
    initialWindowSize = 75_000,
    minWindowSize = 2_000,
    timeoutMs = 8_000
  } = args;

  const latestRaw = await withTimeout(scanProvider?.getBlockNumber?.() ?? Promise.resolve(0), timeoutMs, "toggle scan getBlockNumber");
  const latest = Number(latestRaw);
  if (!Number.isFinite(latest) || latest < 0) {
    throw new Error("RPC returned an invalid block number.");
  }

  let windowSize = initialWindowSize;
  const collected: any[] = [];

  const pullRange = async (fromBlock: number, toBlock: number) => {
    const [onLogs, offLogs] = await Promise.all([
      withTimeout(
        (readContract as any).queryFilter(onFilter, fromBlock, toBlock),
        timeoutMs,
        `toggle scan ${onEventName} ${fromBlock}-${toBlock}`
      ),
      withTimeout(
        (readContract as any).queryFilter(offFilter, fromBlock, toBlock),
        timeoutMs,
        `toggle scan ${offEventName} ${fromBlock}-${toBlock}`
      )
    ]);

    const all = [...(onLogs as any[]), ...(offLogs as any[])];
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
      if (windowSize <= minWindowSize) throw new Error(`RPC could not serve ${address} ${onEventName}/${offEventName} log range.`);
      windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
    }
  }

  const state = new Map<string, { enabled: boolean; lastBlock: number; lastIndex: number }>();
  for (const log of collected) {
    let parsed: LogDescription | null = null;
    try {
      parsed = iface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
    } catch {
      parsed = null;
    }
    if (!parsed) continue;

    const tokenIdBig = parsed.args?.[tokenIdArgIndex] as bigint | undefined;
    if (!tokenIdBig) continue;

    const tokenId = tokenIdBig.toString();
    const blockNumber = Number((log as any).blockNumber ?? 0);
    const logIndex = getLogOrderIndex(log);

    if (parsed.name === onEventName) {
      state.set(tokenId, { enabled: true, lastBlock: blockNumber, lastIndex: logIndex });
    } else if (parsed.name === offEventName) {
      state.set(tokenId, { enabled: false, lastBlock: blockNumber, lastIndex: logIndex });
    }
  }

  return Array.from(state.entries())
    .filter(([, v]) => v.enabled)
    .sort((a, b) => {
      const db = b[1].lastBlock - a[1].lastBlock;
      if (db !== 0) return db;
      return b[1].lastIndex - a[1].lastIndex;
    })
    .map(([tokenId]) => tokenId);
}
