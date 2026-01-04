import { useEffect, useRef, useState } from "react";
import { isAddress } from "ethers";

import { fetchPosterStatuses } from "@shared/lib/posterStatus";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";
import { getEnv } from "@shared/lib/env";
import type { ReadContractFactory } from "@features/contract";

export function usePosterStatusMaps(args: {
  open: boolean;
  isOwner: boolean;
  pendingApprovals: string[];
  onChainRequests: string[];
  getReadContract: ReadContractFactory;
  chainId?: string | null;
}) {
  const getReadContractRef = useRef<ReadContractFactory>(args.getReadContract);
  useEffect(() => {
    getReadContractRef.current = args.getReadContract;
  }, [args.getReadContract]);

  const addressesKey = Array.from(
    new Set(
      [...args.pendingApprovals, ...args.onChainRequests]
        .map((a) => String(a ?? "").trim())
        .filter((a) => a && isAddress(a))
        .map((a) => a.toLowerCase())
    )
  )
    .sort()
    .join(",");

  const [posterAllowedByAddress, setPosterAllowedByAddress] = useState<Record<string, boolean>>({});
  const [posterDisapprovedEverByAddress, setPosterDisapprovedEverByAddress] = useState<Record<string, boolean>>({});
  const [isLoadingPosterStatuses, setIsLoadingPosterStatuses] = useState(false);

  useEffect(() => {
    if (!args.open) return;
    if (!args.isOwner) return;

    if (!addressesKey) return;

    const missing: string[] = addressesKey.split(",").filter(Boolean);

    let cancelled = false;
    void (async () => {
      setIsLoadingPosterStatuses(true);
      try {
        const env = getEnv();
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
              variables: { ids: missing.map((a) => a.toLowerCase()) },
              timeoutMs: 10_000
            });

            const accounts = Array.isArray(data?.accounts) ? data.accounts : [];

            const byId = new Map(accounts.map((a) => [a.id.toLowerCase(), a] as const));

            if (cancelled) return;
            const nextAllowed: Record<string, boolean> = {};
            const nextDisapproved: Record<string, boolean> = {};
            const missingAfterSubgraph: string[] = [];

            for (const addr of missing) {
              const key = addr.toLowerCase();
              const row = byId.get(key);
              if (!row) {
                missingAfterSubgraph.push(addr);
                continue;
              }
              nextAllowed[key] = !!row.posterAllowed;
              nextDisapproved[key] = !!row.disapprovedEver;
            }

            if (Object.keys(nextAllowed).length) setPosterAllowedByAddress((prev) => ({ ...prev, ...nextAllowed }));
            if (Object.keys(nextDisapproved).length) setPosterDisapprovedEverByAddress((prev) => ({ ...prev, ...nextDisapproved }));

            if (missingAfterSubgraph.length === 0) return;
            missing.length = 0;
            missing.push(...missingAfterSubgraph);
          } catch {
            // fall back to contract
          }
        }

        const readContract = await getReadContractRef.current();
        const checks = await fetchPosterStatuses(readContract, missing);

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
      } finally {
        if (!cancelled) setIsLoadingPosterStatuses(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsLoadingPosterStatuses(false);
    };
  }, [args.open, args.isOwner, args.chainId, addressesKey]);

  return {
    posterAllowedByAddress,
    posterDisapprovedEverByAddress,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress,
    isLoadingPosterStatuses
  };
}
