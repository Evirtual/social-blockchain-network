import { useEffect, useState } from "react";
import { isAddress } from "ethers";

import { fetchPosterStatuses } from "@shared/lib/posterStatus";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";

export function usePosterStatusMaps(args: {
  open: boolean;
  isOwner: boolean;
  pendingApprovals: string[];
  onChainRequests: string[];
  getReadContract: () => Promise<any>;
  chainId?: string | null;
}) {
  const [posterAllowedByAddress, setPosterAllowedByAddress] = useState<Record<string, boolean>>({});
  const [posterDisapprovedEverByAddress, setPosterDisapprovedEverByAddress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!args.open) return;
    if (!args.isOwner) return;

    const byKey = new Map<string, string>();
    for (const a of [...args.pendingApprovals, ...args.onChainRequests]) {
      const raw = (a ?? "").trim();
      if (!raw) continue;
      if (!isAddress(raw)) continue;
      const key = raw.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, raw);
    }

    const addrs = Array.from(byKey.values());
    if (addrs.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const env = import.meta.env as any;
        const chainIdNum = parseChainIdNumber(args.chainId ?? null);
        const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);

        if (subgraphUrl) {
          try {
            const query = `
              query PosterStatuses($ids: [ID!]!) {
                accounts(where: { id_in: $ids }, first: 1000) {
                  id
                  posterAllowed
                  disapprovedEver
                }
              }
            `;

            const data = await querySubgraph<{
              accounts: Array<{ id: string; posterAllowed: boolean; disapprovedEver: boolean }>;
            }>({
              url: subgraphUrl,
              query,
              variables: { ids: addrs.map((a) => a.toLowerCase()) },
              timeoutMs: 10_000
            });

            const accounts = Array.isArray(data?.accounts) ? data.accounts : [];

            // If the subgraph is reachable but hasn't indexed these accounts yet, fall back.
            if (accounts.length === 0) throw new Error("subgraph returned no accounts");

            const byId = new Map(accounts.map((a) => [a.id.toLowerCase(), a] as const));

            if (cancelled) return;
            setPosterAllowedByAddress((prev) => {
              const next = { ...prev };
              for (const addr of addrs) {
                const row = byId.get(addr.toLowerCase());
                if (row) next[addr.toLowerCase()] = !!row.posterAllowed;
              }
              return next;
            });

            setPosterDisapprovedEverByAddress((prev) => {
              const next = { ...prev };
              for (const addr of addrs) {
                const row = byId.get(addr.toLowerCase());
                if (row) next[addr.toLowerCase()] = !!row.disapprovedEver;
              }
              return next;
            });

            return;
          } catch {
            // fall back to contract
          }
        }

        const readContract = await args.getReadContract();
        const checks = await fetchPosterStatuses(readContract, addrs);

        if (cancelled) return;
        setPosterAllowedByAddress((prev) => {
          const next = { ...prev };
          for (const c of checks) next[c.address.toLowerCase()] = c.allowed;
          return next;
        });

        setPosterDisapprovedEverByAddress((prev) => {
          const next = { ...prev };
          for (const c of checks) next[c.address.toLowerCase()] = c.disapprovedEver;
          return next;
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [args.open, args.isOwner, args.pendingApprovals, args.onChainRequests, args.getReadContract, args.chainId]);

  return {
    posterAllowedByAddress,
    posterDisapprovedEverByAddress,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress
  };
}
