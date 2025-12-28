import { useEffect, useState } from "react";
import { isAddress } from "ethers";

import { fetchPosterStatuses } from "@shared/lib/posterStatus";

export function usePosterStatusMaps(args: {
  open: boolean;
  isOwner: boolean;
  pendingApprovals: string[];
  onChainRequests: string[];
  getReadContract: () => Promise<any>;
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
  }, [args.open, args.isOwner, args.pendingApprovals, args.onChainRequests, args.getReadContract]);

  return {
    posterAllowedByAddress,
    posterDisapprovedEverByAddress,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress
  };
}
