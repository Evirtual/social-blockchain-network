import { useEffect, useState } from "react";
import { isAddress } from "ethers";

import { scanRecentUniqueAddressesFromEvent } from "@features/profile";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import {
  readApprovalsChainRequestsCache,
  writeApprovalsChainRequestsCache
} from "@shared/lib/approvalsCache";


const APPROVALS_CHAIN_CACHE_TTL_MS = 60_000;

export function useOnChainApprovalRequests(args: {
  open: boolean;
  isOwner: boolean;
  contractAddress: string | undefined;
  getReadContract: () => Promise<any>;
}) {
  const [onChainRequests, setOnChainRequests] = useState<string[]>(() => {
    const cached = readApprovalsChainRequestsCache(args.contractAddress);
    return cached?.requesters ?? [];
  });
  const [isLoadingOnChainRequests, setIsLoadingOnChainRequests] = useState(false);
  const [onChainRequestsLoadError, setOnChainRequestsLoadError] = useState(false);

  useEffect(() => {
    const cached = readApprovalsChainRequestsCache(args.contractAddress);
    setOnChainRequests(cached?.requesters ?? []);
    setIsLoadingOnChainRequests(false);
    setOnChainRequestsLoadError(false);
  }, [args.contractAddress]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.isOwner) {
      setOnChainRequests([]);
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      return;
    }

    const cached = readApprovalsChainRequestsCache(args.contractAddress);
    const isCachedFresh =
      !!cached && typeof cached.updatedAt === "number" && Date.now() - cached.updatedAt < APPROVALS_CHAIN_CACHE_TTL_MS;

    if (cached) {
      setOnChainRequests(cached.requesters);
      setOnChainRequestsLoadError(false);
      setIsLoadingOnChainRequests(false);
      if (isCachedFresh) return;
    }

    let cancelled = false;
    void (async () => {
      const showLoading = !cached;
      if (showLoading) setIsLoadingOnChainRequests(true);
      setOnChainRequestsLoadError(false);
      try {
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

        if (!hadQueryError || uniq.length > 0) {
          writeApprovalsChainRequestsCache(args.contractAddress, uniq);
        }

        if (!cancelled) {
          setOnChainRequests(uniq);
          setOnChainRequestsLoadError(!cached && hadQueryError && uniq.length === 0);
        }
      } catch {
        if (!cancelled && !cached) {
          setOnChainRequests([]);
          setOnChainRequestsLoadError(true);
        }
      } finally {
        if (!cancelled && !cached) setIsLoadingOnChainRequests(false);
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
