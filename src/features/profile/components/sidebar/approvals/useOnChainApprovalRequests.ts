import { useEffect, useState } from "react";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { fetchApprovalRequests } from "@features/profile/services/approvals";
import { getEnv } from "@shared/lib/env";
import type { ReadContractFactory } from "@features/contract";

export function useOnChainApprovalRequests(args: {
  open: boolean;
  isOwner: boolean;
  chainId: string | null;
  contractAddress: string | undefined;
  getReadContract: ReadContractFactory;
}) {
  const cacheKey = `${String(args.chainId ?? "").trim()}:${String(args.contractAddress ?? "").trim().toLowerCase()}`;

  const [onChainRequests, setOnChainRequests] = useState<string[]>([]);
  const [isLoadingOnChainRequests, setIsLoadingOnChainRequests] = useState(false);
  const [onChainRequestsLoadError, setOnChainRequestsLoadError] = useState(false);

  useEffect(() => {
    setOnChainRequests([]);
    setIsLoadingOnChainRequests(false);
    setOnChainRequestsLoadError(false);
  }, [cacheKey]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.chainId || !args.contractAddress) {
      setOnChainRequests([]);
      setIsLoadingOnChainRequests(false);
      setOnChainRequestsLoadError(false);
      return;
    }
    if (!args.isOwner) {
      setOnChainRequests([]);
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
          getReadContract: args.getReadContract
        });

        if (!cancelled) {
          setOnChainRequests(addresses);
          setOnChainRequestsLoadError(hadQueryError && addresses.length === 0);
        }
      } catch {
        if (!cancelled) {
          setOnChainRequests([]);
          setOnChainRequestsLoadError(true);
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
