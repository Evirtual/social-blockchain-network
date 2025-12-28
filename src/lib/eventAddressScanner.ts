import { withTimeout } from "./feedQuery";

export type AddressLogScannerOptions<TLog> = {
  scanProvider: { getBlockNumber?: () => Promise<number> } | null | undefined;
  readContract: any;
  filter: any;

  extractAddress: (log: TLog) => string;
  isValidAddress?: (addr: string) => boolean;

  maxUnique?: number;
  maxRounds?: number;
  initialWindowSize?: number;
  minWindowSize?: number;
  maxTimeMs?: number;
  timeoutMs?: number;
};

export type AddressLogScannerResult = {
  addresses: string[];
  hadQueryError: boolean;
};

export async function scanRecentUniqueAddressesFromEvent<TLog = any>(
  opts: AddressLogScannerOptions<TLog>
): Promise<AddressLogScannerResult> {
  const {
    scanProvider,
    readContract,
    filter,
    extractAddress,
    isValidAddress,
    maxUnique = 50,
    maxRounds = 20,
    initialWindowSize = 50_000,
    minWindowSize = 1_000,
    maxTimeMs = 8_000,
    timeoutMs = 8_000
  } = opts;

  const latestRaw = await withTimeout(scanProvider?.getBlockNumber?.() ?? Promise.resolve(0), timeoutMs, "address scan getBlockNumber");
  const latest = Number(latestRaw);
  if (!Number.isFinite(latest) || latest < 0) return { addresses: [], hadQueryError: false };

  const uniq: string[] = [];
  const seen = new Set<string>();
  let hadQueryError = false;

  let end = latest;
  let windowSize = initialWindowSize;
  const startedAt = Date.now();

  for (let round = 0; round < maxRounds && end >= 0 && uniq.length < maxUnique; round++) {
    if (Date.now() - startedAt > maxTimeMs) break;

    const start = Math.max(0, end - windowSize);
    try {
      const logs = (await withTimeout(
        (readContract as any).queryFilter(filter, start, end),
        timeoutMs,
        `address scan ${start}-${end}`
      )) as TLog[];

      for (let i = logs.length - 1; i >= 0 && uniq.length < maxUnique; i--) {
        const addr = (extractAddress(logs[i]) ?? "").trim();
        if (!addr) continue;
        if (isValidAddress && !isValidAddress(addr)) continue;

        const key = addr.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(addr);
      }

      if (start === 0) break;
      end = start - 1;
    } catch {
      hadQueryError = true;
      if (windowSize <= minWindowSize) break;
      windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
    }
  }

  return { addresses: uniq, hadQueryError };
}
