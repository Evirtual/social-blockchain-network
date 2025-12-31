import { useEffect, useRef, useState } from "react";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { fetchApprovalRequests } from "./approvalRequests";

type ApprovalsRequestsCacheEntry = {
  requesters: string[];
  hadQueryError: boolean;
  loadedAt: number;
};

// In-memory cache to preserve results across route navigation (SPA).
// Resets on page refresh by design.
const approvalsRequestsCache = new Map<string, ApprovalsRequestsCacheEntry>();
const APPROVALS_CACHE_TTL_MS = 60_000;

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
  }, [cacheKey]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.chainId || !args.contractAddress) {
      setOnChainRequests([]);
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      lastLoadedKeyRef.current = null;
      return;
    }
    if (!args.isOwner) {
      setOnChainRequests([]);
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      lastLoadedKeyRef.current = null;
      return;
    }

    const cached = approvalsRequestsCache.get(cacheKey);
    // If we have any cached result for this network+contract, do not re-load on reopen.
    if (cached && lastLoadedKeyRef.current === cacheKey && Date.now() - cached.loadedAt < APPROVALS_CACHE_TTL_MS) {
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
        const { addresses, hadQueryError } = await fetchApprovalRequests({
          subgraphUrl,
          getReadContract: args.getReadContract
        });

        if (!cancelled) {
          setOnChainRequests(addresses);
          setOnChainRequestsLoadError(hadQueryError && addresses.length === 0);
          approvalsRequestsCache.set(cacheKey, {
            requesters: addresses,
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
  }, [args.open, args.isOwner, args.chainId, args.contractAddress, args.getReadContract, cacheKey]);

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
