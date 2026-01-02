import type { Contract, ContractEventName, EventLog, Interface, Log, LogDescription, Provider } from "ethers";
import { withTimeout } from "./feedQuery";

function getLogOrderIndex(log: Log | EventLog): number {
  const idx = Number(log.index ?? 0);
  return Number.isFinite(idx) ? idx : 0;
}


export type ScanActiveToggleKeysArgs = {
  readContract: Contract;
  scanProvider: Provider;
  iface: Interface;

  onFilter: ContractEventName;
  offFilter: ContractEventName;
  onEventName: string;
  offEventName: string;

  keyArgIndex: number;
  keyArgType: "bigint" | "string";
  normalizeKey?: (key: string) => string;

  maxRounds?: number;
  maxEvents?: number;
  initialWindowSize?: number;
  minWindowSize?: number;
  errorLabel?: string;
  timeoutMs?: number;
};

export async function scanActiveToggleKeys(args: ScanActiveToggleKeysArgs): Promise<string[]> {
  const {
    readContract,
    scanProvider,
    iface,
    onFilter,
    offFilter,
    onEventName,
    offEventName,
    keyArgIndex,
    keyArgType,
    normalizeKey,
    maxRounds = 60,
    maxEvents = 5_000,
    initialWindowSize = 75_000,
    minWindowSize = 2_000,
    errorLabel = "toggle",
    timeoutMs = 8_000
  } = args;

  const latestRaw = await withTimeout(
    scanProvider?.getBlockNumber?.() ?? Promise.resolve(0),
    timeoutMs,
    `${errorLabel} scan getBlockNumber`
  );
  const latest = Number(latestRaw);
  if (!Number.isFinite(latest) || latest < 0) {
    throw new Error("RPC returned an invalid block number.");
  }

  let windowSize = initialWindowSize;
  const collected: Array<EventLog | Log> = [];

  const pullRange = async (fromBlock: number, toBlock: number) => {
    const [onLogs, offLogs] = await Promise.all([
      withTimeout(readContract.queryFilter(onFilter, fromBlock, toBlock), timeoutMs, `${errorLabel} scan ${onEventName} ${fromBlock}-${toBlock}`),
      withTimeout(readContract.queryFilter(offFilter, fromBlock, toBlock), timeoutMs, `${errorLabel} scan ${offEventName} ${fromBlock}-${toBlock}`)
    ]);

    const all = [...onLogs, ...offLogs];
    return all.sort((a, b) => {
      const ab = Number(a.blockNumber ?? 0);
      const bb = Number(b.blockNumber ?? 0);
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
      if (windowSize <= minWindowSize) {
        throw new Error(`RPC could not serve ${errorLabel} log range.`);
      }
      windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
    }
  }

  const state = new Map<string, { enabled: boolean; lastBlock: number; lastIndex: number }>();
  for (const log of collected) {
    let parsed: LogDescription | null = null;
    try {
      parsed = iface.parseLog(log);
    } catch {
      parsed = null;
    }
    if (!parsed) continue;

    let key: string | null = null;
    if (keyArgType === "bigint") {
      const v = parsed.args?.[keyArgIndex] as bigint | undefined;
      if (typeof v === "bigint") key = v.toString();
    } else {
      const v = parsed.args?.[keyArgIndex] as string | undefined;
      if (typeof v === "string") {
        const trimmed = v.trim();
        key = trimmed.length ? trimmed : null;
      }
    }

    if (!key) continue;
    const normalized = normalizeKey ? normalizeKey(key) : key;

    const blockNumber = Number(log.blockNumber ?? 0);
    const logIndex = getLogOrderIndex(log);

    if (parsed.name === onEventName) {
      state.set(normalized, { enabled: true, lastBlock: blockNumber, lastIndex: logIndex });
    } else if (parsed.name === offEventName) {
      state.set(normalized, { enabled: false, lastBlock: blockNumber, lastIndex: logIndex });
    }
  }

  return Array.from(state.entries())
    .filter(([, v]) => v.enabled)
    .sort((a, b) => {
      const db = b[1].lastBlock - a[1].lastBlock;
      if (db !== 0) return db;
      return b[1].lastIndex - a[1].lastIndex;
    })
    .map(([key]) => key);
}
