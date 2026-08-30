import type { BrowserProvider } from "ethers";
import { useCallback } from "react";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { resolveConfiguredSocialPostsAddress } from "@shared/lib/configuredSocialPostsAddress";
import type { ReadContractFactory } from "../types";

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
  setProtocolTreasuryAddress: (v: string | null) => void;
  setTreasuryWithdrawableTipsWei: (v: bigint) => void;
  setTreasuryNativeBalanceWei: (v: bigint) => void;
}) {
  return useCallback(async () => {
    if (!params.provider) return;

    const resetNonDeployed = () => {
      params.setWithdrawableTipsWei(0n);
      params.setWithdrawFeeBps(0);
      params.setTipSupportPreferenceBps(0);
      params.setProtocolTreasuryAddress(null);
      params.setTreasuryWithdrawableTipsWei(0n);
      params.setTreasuryNativeBalanceWei(0n);
    };

    const isZeroAddress = (a: string | null | undefined) => {
      if (!a) return true;
      return a.toLowerCase() === "0x0000000000000000000000000000000000000000";
    };

    try {
      const network = await params.provider.getNetwork();
      params.chainIdNumberRef.current = Number(network.chainId);
    } catch {
      // ignore
    }

    const addr = resolveConfiguredSocialPostsAddress(parseChainIdNumber(params.chainId) ?? params.chainIdNumberRef.current);
    if (!addr) {
      params.setContractDeployed(null);
      resetNonDeployed();
      return;
    }

    try {
      const code = await params.provider.getCode(addr);
      const deployed = Boolean(code && code !== "0x");
      params.setContractDeployed(deployed);
      if (!deployed) {
        resetNonDeployed();
        return;
      }
    } catch {
      params.setContractDeployed(null);
    }

    try {
      const readContract = await params.getReadContract();

      try {
        const feeBps = (await readContract.withdrawFeeBps()) as bigint;
        params.setWithdrawFeeBps(Number(feeBps));
      } catch {
        // Old deployments may not have this method.
        params.setWithdrawFeeBps(0);
      }

      let treasuryAddr: string | null = null;
      try {
        treasuryAddr = (await readContract.protocolTreasury()) as string;
      } catch {
        treasuryAddr = null;
      }

      if (isZeroAddress(treasuryAddr)) treasuryAddr = null;
      params.setProtocolTreasuryAddress(treasuryAddr);

      if (treasuryAddr) {
        try {
          const tw = (await readContract.withdrawableOf(treasuryAddr)) as bigint;
          params.setTreasuryWithdrawableTipsWei(tw);
        } catch {
          params.setTreasuryWithdrawableTipsWei(0n);
        }

        try {
          const bal = await params.provider.getBalance(treasuryAddr);
          params.setTreasuryNativeBalanceWei(bal);
        } catch {
          params.setTreasuryNativeBalanceWei(0n);
        }
      } else {
        params.setTreasuryWithdrawableTipsWei(0n);
        params.setTreasuryNativeBalanceWei(0n);
      }

      if (!params.walletAddress) {
        params.setWithdrawableTipsWei(0n);
        params.setTipSupportPreferenceBps(0);
        return;
      }

      const w = (await readContract.withdrawableOf(params.walletAddress)) as bigint;
      params.setWithdrawableTipsWei(w);

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
    params.setTipSupportPreferenceBps,
    params.setProtocolTreasuryAddress,
    params.setTreasuryWithdrawableTipsWei,
    params.setTreasuryNativeBalanceWei
  ]);
}
