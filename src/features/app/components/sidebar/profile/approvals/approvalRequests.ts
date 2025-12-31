import { isAddress } from "ethers";

import { scanRecentUniqueAddressesFromEvent } from "@features/profile";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { querySubgraph } from "@shared/lib/subgraphQuery";

type ApprovalRequestsResult = {
  addresses: string[];
  hadQueryError: boolean;
  source: "subgraph" | "chain";
};

export async function fetchApprovalRequests(args: {
  subgraphUrl: string | null;
  getReadContract: () => Promise<any>;
}): Promise<ApprovalRequestsResult> {
  if (args.subgraphUrl) {
    try {
      const query = `
        query ApprovalRequests($first: Int!) {
          accounts(
            first: $first,
            where: { or: [{ posterRequested: true }, { posterAllowed: true }] },
            orderBy: updatedAtBlock,
            orderDirection: desc
          ) {
            id
          }
        }
      `;

      const data = await querySubgraph<{ accounts: Array<{ id?: string }> }>({
        url: args.subgraphUrl,
        query,
        variables: { first: 50 },
        timeoutMs: 10_000
      });

      const uniq = (Array.isArray(data?.accounts) ? data.accounts : [])
        .map((a) => String(a?.id ?? "").trim())
        .filter((a) => isAddress(a));

      if (uniq.length > 0) {
        return { addresses: uniq, hadQueryError: false, source: "subgraph" };
      }
    } catch {
      // fall back to on-chain scan
    }
  }

  const readContract = await args.getReadContract();
  const provider: any = getScanProviderFromReadContract(readContract);

  const latestRaw = (await provider?.getBlockNumber?.()) ?? 0;
  const latest = Number(latestRaw);
  if (!Number.isFinite(latest) || latest < 0) {
    return { addresses: [], hadQueryError: false, source: "chain" };
  }

  const filter = (readContract as any).filters.PosterApprovalRequested();

  const { addresses: uniq, hadQueryError } = await scanRecentUniqueAddressesFromEvent({
    scanProvider: provider,
    readContract,
    filter,
    extractAddress: (l: any) => (l?.args?.[0] as string | undefined) ?? "",
    isValidAddress: (a: string) => isAddress(a),
    maxUnique: 50,
    maxRounds: 20,
    initialWindowSize: 50_000,
    minWindowSize: 1_000,
    maxTimeMs: 8_000
  });

  return { addresses: uniq, hadQueryError: hadQueryError && uniq.length === 0, source: "chain" };
}
