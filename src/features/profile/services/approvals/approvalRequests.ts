import { isAddress } from "ethers";

import { scanRecentUniqueAddressesFromEvent } from "../eventAddressScanner";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { querySubgraph } from "@shared/lib/subgraphQuery";
import type { ReadContractFactory } from "@features/contract";

type ApprovalRequestsResult = {
  addresses: string[];
  hadQueryError: boolean;
  source: "subgraph" | "chain";
};

export async function fetchApprovalRequests(args: {
  subgraphUrl: string | null;
  getReadContract: ReadContractFactory;
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
  const provider = getScanProviderFromReadContract(readContract);
  if (!provider) {
    return { addresses: [], hadQueryError: false, source: "chain" };
  }

  const requestedFilter = readContract.filters.PosterApprovalRequested();
  const allowedFilter = readContract.filters.PosterAllowed();

  const [requested, allowed] = await Promise.all([
    scanRecentUniqueAddressesFromEvent({
      scanProvider: provider,
      readContract,
      filter: requestedFilter,
      extractAddress: (log) => {
        if ("args" in log) {
          return String(log.args?.[0] ?? "");
        }
        return "";
      },
      isValidAddress: (a: string) => isAddress(a),
      maxUnique: 50,
      maxRounds: 20,
      initialWindowSize: 50_000,
      minWindowSize: 1_000,
      maxTimeMs: 8_000
    }),
    scanRecentUniqueAddressesFromEvent({
      scanProvider: provider,
      readContract,
      filter: allowedFilter,
      extractAddress: (log) => {
        if ("args" in log) {
          const addr = String(log.args?.[0] ?? "");
          const isAllowed = Boolean(log.args?.[1]);
          return isAllowed ? addr : "";
        }
        return "";
      },
      isValidAddress: (a: string) => isAddress(a),
      maxUnique: 50,
      maxRounds: 20,
      initialWindowSize: 50_000,
      minWindowSize: 1_000,
      maxTimeMs: 8_000
    })
  ]);

  // Merge (interleaving) so both approved+requested show up.
  const merged: string[] = [];
  const seen = new Set<string>();
  const max = 50;
  const requestedAddrs = requested.addresses ?? [];
  const allowedAddrs = allowed.addresses ?? [];

  const maxLen = Math.max(requestedAddrs.length, allowedAddrs.length);
  for (let i = 0; i < maxLen && merged.length < max; i++) {
    const a = requestedAddrs[i];
    if (a) {
      const k = a.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(a);
      }
    }

    const b = allowedAddrs[i];
    if (b) {
      const k = b.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(b);
      }
    }
  }

  const hadQueryError = (requested.hadQueryError || allowed.hadQueryError) && merged.length === 0;
  return { addresses: merged, hadQueryError, source: "chain" };
}
