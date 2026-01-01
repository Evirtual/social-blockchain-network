import { useEffect } from "react";
import type { BrowserProvider } from "ethers";
import { parseChainIdNumber } from "@shared/lib/chainId";

export function useWalletEvents(params: {
  provider: BrowserProvider | null;
  isWalletAutoConnectDisabled: boolean;
  setDisconnectedState: (statusMessage: string) => void;
  setWalletAddress: (v: string | null) => void;
  setNativeBalance: (v: string) => void;
  setChainId: (v: string | null) => void;
  setNetworkName: (v: string | null) => void;
  setStatus: (v: string) => void;
  bumpProviderNonce: () => void;
  bumpWalletEpoch: () => void;
}) {
  useEffect(() => {
    if (!params.provider) return;
    const eth = (window.ethereum as any) ?? null;
    if (!eth?.on) return;

    const onAccountsChanged = async (accounts: string[]) => {
      if (params.isWalletAutoConnectDisabled) {
        params.setDisconnectedState("Wallet disconnected");
        return;
      }

      const addr = accounts?.[0] ?? null;
      params.setWalletAddress(addr);
      params.setNativeBalance("—");

      try {
        const network = await params.provider!.getNetwork();
        params.setChainId(network.chainId.toString());
        params.setNetworkName(network.name);
      } catch {
        // ignore
      }

      if (!addr) {
        params.setDisconnectedState("Wallet disconnected");
        return;
      }

      params.setStatus("Wallet connected.");
      params.bumpWalletEpoch();
    };

    const onChainChanged = async (nextChainId?: string) => {
      try {
        params.setStatus("Network changed.");

        if (typeof nextChainId === "string" && nextChainId.length > 0) {
          // EIP-1193 chainChanged gives hex chainId.
          const n = parseChainIdNumber(nextChainId);
          params.setChainId(n == null ? null : String(n));
        }

        // Recreate provider to avoid stale network info.
        params.bumpProviderNonce();
        params.bumpWalletEpoch();
      } catch {
        // ignore
      }
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [
    params.provider,
    params.isWalletAutoConnectDisabled,
    params.setDisconnectedState,
    params.setWalletAddress,
    params.setNativeBalance,
    params.setChainId,
    params.setNetworkName,
    params.setStatus,
    params.bumpProviderNonce,
    params.bumpWalletEpoch
  ]);
}
