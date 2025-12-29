import { useEffect, useRef, useState } from "react";
import { isAddress } from "ethers";

import { scanRecentUniqueAddressesFromEvent } from "@features/profile";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";

type ApprovalsRequestsCacheEntry = {
  requesters: string[];
  hadQueryError: boolean;
  loadedAt: number;
};

// In-memory cache to preserve results across route navigation (SPA).
// Resets on page refresh by design.
const approvalsRequestsCache = new Map<string, ApprovalsRequestsCacheEntry>();

export function useOnChainApprovalRequests(args: {
  open: boolean;
  isOwner: boolean;
  chainId: string | null;
  contractAddress: string | undefined;
  getReadContract: () => Promise<any>;
}) {
  const cacheKey = `${String(args.chainId ?? "").trim()}:${String(args.contractAddress ?? "").trim().toLowerCase()}`;

  const [onChainRequests, setOnChainRequests] = useState<string[]>(() => {
    const cached = approvalsRequestsCache.get(cacheKey);
    return cached?.requesters ?? [];
  });
  const [isLoadingOnChainRequests, setIsLoadingOnChainRequests] = useState(false);
  const [onChainRequestsLoadError, setOnChainRequestsLoadError] = useState(() => {
    const cached = approvalsRequestsCache.get(cacheKey);
    return !!cached?.hadQueryError && (cached.requesters?.length ?? 0) === 0;
  });

  const lastLoadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const cached = approvalsRequestsCache.get(cacheKey);
    setOnChainRequests(cached?.requesters ?? []);
    setIsLoadingOnChainRequests(false);
    setOnChainRequestsLoadError(!!cached?.hadQueryError && (cached.requesters?.length ?? 0) === 0);
    lastLoadedKeyRef.current = cached ? cacheKey : null;
  }, [args.chainId, args.contractAddress]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.isOwner) {
      setOnChainRequests([]);
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      lastLoadedKeyRef.current = null;
      return;
    }

    const cached = approvalsRequestsCache.get(cacheKey);
    // If we have any cached result for this network+contract, do not re-load on reopen.
    if (cached && lastLoadedKeyRef.current === cacheKey) {
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(!!cached.hadQueryError && cached.requesters.length === 0);
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsLoadingOnChainRequests(true);
      setOnChainRequestsLoadError(false);
      try {
        const env = import.meta.env as any;
        const chainIdNum = parseChainIdNumber(args.chainId);
        const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
        if (subgraphUrl) {
          try {
            const query = `
              query ApprovalRequests($first: Int!) {
                accounts(
                  first: $first,
                  where: { posterRequested: true },
                  orderBy: updatedAtBlock,
                  orderDirection: desc
                ) {
                  id
                }
              }
            `;

            const data = await querySubgraph<{ accounts: Array<{ id?: string }> }>({
              url: subgraphUrl,
              query,
              variables: { first: 50 },
              timeoutMs: 10_000
            });

            const uniq = (Array.isArray(data?.accounts) ? data.accounts : [])
              .map((a) => String(a?.id ?? "").trim())
              .filter((a) => isAddress(a));

            // If the subgraph is reachable but has no data yet (common right after deploy),
            // fall back to chain scanning so the admin UI remains functional.
            if (uniq.length > 0) {
              if (!cancelled) {
                setOnChainRequests(uniq);
                setOnChainRequestsLoadError(false);
                approvalsRequestsCache.set(cacheKey, {
                  requesters: uniq,
                  hadQueryError: false,
                  loadedAt: Date.now()
                });
                lastLoadedKeyRef.current = cacheKey;
              }
              return;
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
          if (!cancelled) setOnChainRequests([]);
          return;
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

        if (!cancelled) {
          setOnChainRequests(uniq);
          setOnChainRequestsLoadError(hadQueryError && uniq.length === 0);
          approvalsRequestsCache.set(cacheKey, {
            requesters: uniq,
            hadQueryError,
            loadedAt: Date.now()
          });
          lastLoadedKeyRef.current = cacheKey;
        }
      } catch {
        if (!cancelled) {
          setOnChainRequests([]);
          setOnChainRequestsLoadError(true);
          approvalsRequestsCache.set(cacheKey, {
            requesters: [],
            hadQueryError: true,
            loadedAt: Date.now()
          });
        }
      } finally {
        if (!cancelled) setIsLoadingOnChainRequests(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [args.open, args.isOwner, args.contractAddress, args.getReadContract]);

  useEffect(() => {
    if (args.open) return;
    setIsLoadingOnChainRequests(false);
    setOnChainRequestsLoadError(false);
  }, [args.open]);

  return {
    onChainRequests,
    isLoadingOnChainRequests,
    onChainRequestsLoadError
  };
}
