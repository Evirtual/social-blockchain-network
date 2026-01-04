import { useEffect, useRef, useState } from "react";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { fetchApprovalRequests } from "@features/profile/services/approvals";
import { getEnv } from "@shared/lib/env";
import { readApprovalsChainRequestsCache, writeApprovalsChainRequestsCache } from "@shared/lib/approvalsCache";
import type { ReadContractFactory } from "@features/contract";

const APPROVAL_REQUESTS_CACHE_TTL_MS = 60_000;

export function useOnChainApprovalRequests(args: {
  open: boolean;
  isOwner: boolean;
  chainId: string | null;
  contractAddress: string | undefined;
  getReadContract: ReadContractFactory;
}) {
  const cacheKey = `${String(args.chainId ?? "").trim()}:${String(args.contractAddress ?? "").trim().toLowerCase()}`;

  const getReadContractRef = useRef<ReadContractFactory>(args.getReadContract);
  useEffect(() => {
    getReadContractRef.current = args.getReadContract;
  }, [args.getReadContract]);

  const cached = readApprovalsChainRequestsCache(cacheKey);

  const [onChainRequests, setOnChainRequests] = useState<string[]>(() => cached?.requesters ?? []);
  const [isLoadingOnChainRequests, setIsLoadingOnChainRequests] = useState(false);
  const [onChainRequestsLoadError, setOnChainRequestsLoadError] = useState(false);

  useEffect(() => {
    const nextCached = readApprovalsChainRequestsCache(cacheKey);
    setOnChainRequests(nextCached?.requesters ?? []);
    // Don't force a loading flash just because the key changed.
    setIsLoadingOnChainRequests(false);
    setOnChainRequestsLoadError(false);
  }, [cacheKey]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.chainId || !args.contractAddress) {
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      return;
    }
    if (!args.isOwner) {
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      return;
    }

    const cachedNow = readApprovalsChainRequestsCache(cacheKey);
    const cacheFreshNow = !!cachedNow && Date.now() - cachedNow.updatedAt < APPROVAL_REQUESTS_CACHE_TTL_MS;
    if (cacheFreshNow) {
      setOnChainRequests(cachedNow.requesters);
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsLoadingOnChainRequests(true);
      setOnChainRequestsLoadError(false);
      try {
        const env = getEnv();
        const chainIdNum = parseChainIdNumber(args.chainId);
        const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
        const { addresses, hadQueryError } = await fetchApprovalRequests({
          subgraphUrl,
          getReadContract: getReadContractRef.current
        });

        if (!cancelled) {
          setOnChainRequests(addresses);
          setOnChainRequestsLoadError(hadQueryError && addresses.length === 0);
          writeApprovalsChainRequestsCache(cacheKey, addresses);
        }
      } catch {
        if (!cancelled) {
          setOnChainRequestsLoadError(true);
        }
      } finally {
        if (!cancelled) setIsLoadingOnChainRequests(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [args.open, args.isOwner, args.chainId, args.contractAddress, cacheKey]);

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
