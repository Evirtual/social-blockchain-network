import { queryLogsPaged, withTimeout } from "@shared/lib/feedQuery";
import type { Contract, EventLog, Provider } from "ethers";

export type DiscoverMintedTokenIdsResult = {
  tokenIds: bigint[];
  failed: boolean;
};

export async function discoverMintedTokenIdsForAuthor(opts: {
  readContract: Contract;
  scanProvider: Provider | null | undefined;
  author: string;
}): Promise<DiscoverMintedTokenIdsResult> {
  const { readContract, scanProvider, author } = opts;

  try {
    const latest = Number(
      (await withTimeout(scanProvider?.getBlockNumber?.() ?? Promise.resolve(0), 6000, "getBlockNumber")) ?? 0
    );
    if (!Number.isFinite(latest) || latest < 0) return { tokenIds: [], failed: false };

    const logs = await queryLogsPaged({
      readContract,
      filter: readContract.filters.PostMinted(author),
      fromBlock: 0,
      toBlock: latest,
      label: "discover minted token ids",
      timeoutMs: 8000,
      initialChunkSize: 50_000,
      minChunkSize: 250
    });

    const uniq = new Set<string>();
    for (const log of logs) {
      if ("args" in log) {
        const id = (log as EventLog).args?.[1] as bigint | undefined;
        if (typeof id !== "bigint") continue;
        uniq.add(id.toString());
      }
    }

    const tokenIds = Array.from(uniq).map((s) => BigInt(s));
    return { tokenIds, failed: false };
  } catch {
    return { tokenIds: [], failed: true };
  }
}
