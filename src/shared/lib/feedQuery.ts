import type { Contract, ContractEventName, EventLog, Log, Provider, TopicFilter } from "ethers";

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function queryLogsPaged(args: {
  readContract: Contract;
  filter: ContractEventName;
  fromBlock: number;
  toBlock: number;
  label: string;
  timeoutMs?: number;
  initialChunkSize?: number;
  minChunkSize?: number;
}): Promise<Array<EventLog | Log>> {
  const {
    readContract,
    filter,
    fromBlock,
    toBlock,
    label,
    timeoutMs = 10_000,
    initialChunkSize = 25_000,
    minChunkSize = 100
  } = args;

  const logs: Array<EventLog | Log> = [];

  let chunkSize = initialChunkSize;
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    try {
      const part = await withTimeout(readContract.queryFilter(filter, start, end), timeoutMs, `${label} ${start}-${end}`);
      logs.push(...part);
      start = end + 1;

      // If we previously had to shrink due to an RPC failure,
      // cautiously grow back toward the initial size after successful calls.
      if (chunkSize < initialChunkSize) {
        chunkSize = Math.min(initialChunkSize, Math.max(chunkSize + 1, Math.floor(chunkSize * 2)));
      }
    } catch (err) {
      if (chunkSize <= minChunkSize) throw err;
      chunkSize = Math.max(minChunkSize, Math.floor(chunkSize / 2));
    }
  }

  return logs;
}

export async function queryLogsPagedRaw(args: {
  provider: Provider;
  address: string;
  topics: TopicFilter;
  fromBlock: number;
  toBlock: number;
  label: string;
  timeoutMs?: number;
  initialChunkSize?: number;
  minChunkSize?: number;
}): Promise<Log[]> {
  const {
    provider,
    address,
    topics,
    fromBlock,
    toBlock,
    label,
    timeoutMs = 10_000,
    initialChunkSize = 25_000,
    minChunkSize = 100
  } = args;

  const logs: Log[] = [];

  let chunkSize = initialChunkSize;
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    try {
      const part = await withTimeout(
        provider.getLogs({ address, topics, fromBlock: start, toBlock: end }),
        timeoutMs,
        `${label} ${start}-${end}`
      );
      logs.push(...part);
      start = end + 1;

      if (chunkSize < initialChunkSize) {
        chunkSize = Math.min(initialChunkSize, Math.max(chunkSize + 1, Math.floor(chunkSize * 2)));
      }
    } catch (err) {
      if (chunkSize <= minChunkSize) throw err;
      chunkSize = Math.max(minChunkSize, Math.floor(chunkSize / 2));
    }
  }

  return logs;
}
