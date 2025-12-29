import type { BrowserProvider } from "ethers";
import { useCallback } from "react";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { resolveConfiguredSocialPostsAddress } from "../services/configuredSocialPostsAddress";

export function useRefreshContractState(params: {
  provider: BrowserProvider | null;
  chainId: string | null;
  walletAddress: string | null;
  chainIdNumberRef: React.MutableRefObject<number | null>;
  getReadContract: () => Promise<any>;
  setContractDeployed: (v: boolean | null) => void;
  setWithdrawableTipsWei: (v: bigint) => void;
}) {
  return useCallback(async () => {
    if (!params.provider) return;

    try {
      const network = await params.provider.getNetwork();
      params.chainIdNumberRef.current = Number(network.chainId);
    } catch {
      // ignore
    }

    const addr = resolveConfiguredSocialPostsAddress(parseChainIdNumber(params.chainId) ?? params.chainIdNumberRef.current);
    if (!addr) {
      params.setContractDeployed(null);
      params.setWithdrawableTipsWei(0n);
      return;
    }

    try {
      const code = await params.provider.getCode(addr);
      params.setContractDeployed(Boolean(code && code !== "0x"));
    } catch {
      params.setContractDeployed(null);
    }

    try {
      if (!params.walletAddress) {
        params.setWithdrawableTipsWei(0n);
        return;
      }
      const readContract = await params.getReadContract();
      const w = (await (readContract as any).withdrawableOf(params.walletAddress)) as bigint;
      params.setWithdrawableTipsWei(w);
    } catch {
      // ignore
    }
  }, [
    params.provider,
    params.chainId,
    params.walletAddress,
    params.chainIdNumberRef,
    params.getReadContract,
    params.setContractDeployed,
    params.setWithdrawableTipsWei
  ]);
}
