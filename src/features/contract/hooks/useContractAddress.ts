import { useCallback, useMemo } from "react";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { resolveConfiguredSocialPostsAddress } from "../services/configuredSocialPostsAddress";

export function useContractAddress(params: {
  chainId: string | null;
  chainIdNumberRef: React.MutableRefObject<number | null>;
}) {
  const contractAddress = useMemo(() => {
    const chain = parseChainIdNumber(params.chainId);
    return resolveConfiguredSocialPostsAddress(chain ?? params.chainIdNumberRef.current);
  }, [params.chainId, params.chainIdNumberRef]);

  const requireContractAddress = useCallback(() => {
    const chain = parseChainIdNumber(params.chainId) ?? params.chainIdNumberRef.current;
    const resolved = resolveConfiguredSocialPostsAddress(chain);
    if (resolved) return resolved;

    const chainHint = typeof chain === "number" ? ` (chainId ${chain})` : "";

    throw new Error(
      `Missing contract address${chainHint}. Set it in your environment (e.g. .env.local).\n\n` +
        `For multi-network: set VITE_CONTRACT_ADDRESS_ETH (1) and/or VITE_CONTRACT_ADDRESS_BASE (8453).\n` +
        "For local dev: set VITE_CONTRACT_ADDRESS after deploy:local, then restart the dev server."
    );
  }, [params.chainId, params.chainIdNumberRef]);

  return { contractAddress, requireContractAddress };
}
