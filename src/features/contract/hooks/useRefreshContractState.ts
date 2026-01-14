import type { BrowserProvider } from "ethers";
import { useCallback } from "react";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { resolveConfiguredSocialPostsAddress } from "@shared/lib/configuredSocialPostsAddress";
import type { ReadContractFactory } from "@features/contract";

export function useRefreshContractState(params: {
  provider: BrowserProvider | null;
  chainId: string | null;
  walletAddress: string | null;
  chainIdNumberRef: React.MutableRefObject<number | null>;
  getReadContract: ReadContractFactory;
  setContractDeployed: (v: boolean | null) => void;
  setWithdrawableTipsWei: (v: bigint) => void;
  setWithdrawFeeBps: (v: number) => void;
  setTipSupportPreferenceBps: (v: number) => void;
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
      params.setWithdrawFeeBps(0);
      params.setTipSupportPreferenceBps(0);
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
        params.setWithdrawFeeBps(0);
        params.setTipSupportPreferenceBps(0);
        return;
      }
      const readContract = await params.getReadContract();
      const w = (await readContract.withdrawableOf(params.walletAddress)) as bigint;
      params.setWithdrawableTipsWei(w);

      try {
        const feeBps = (await readContract.withdrawFeeBps()) as bigint;
        params.setWithdrawFeeBps(Number(feeBps));
      } catch {
        // Old deployments may not have this method.
        params.setWithdrawFeeBps(0);
      }

      try {
        const pref = (await readContract.tipSupportPreferenceOf(params.walletAddress)) as bigint;
        params.setTipSupportPreferenceBps(Number(pref));
      } catch {
        // Old deployments may not have this method.
        params.setTipSupportPreferenceBps(0);
      }
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
    params.setWithdrawableTipsWei,
    params.setWithdrawFeeBps,
    params.setTipSupportPreferenceBps
  ]);
}
