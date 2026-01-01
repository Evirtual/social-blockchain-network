import { formatEther, type BrowserProvider } from "ethers";
import { useCallback, useRef } from "react";

export function useRefreshWalletPanel(params: {
  provider: BrowserProvider | null;
  walletAddress: string | null;
  setNetworkName: (v: string | null) => void;
  setChainId: (v: string | null) => void;
  setNativeBalance: (v: string) => void;
}) {
  const refreshWalletInFlightRef = useRef<Promise<void> | null>(null);
  return useCallback(async () => {
    const provider = params.provider;
    if (!provider) return;
    const addr = params.walletAddress;
    if (!addr) return;
    if (refreshWalletInFlightRef.current) {
      await refreshWalletInFlightRef.current;
      return;
    }

    const task = (async () => {
      try {
        const [network, balanceWei] = await Promise.all([provider.getNetwork(), provider.getBalance(addr)]);
        params.setNetworkName(network.name);
        params.setChainId(network.chainId.toString());
        params.setNativeBalance(Number(formatEther(balanceWei)).toFixed(4));
      } catch {
        // ignore
      }
    })();

    refreshWalletInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (refreshWalletInFlightRef.current === task) refreshWalletInFlightRef.current = null;
    }
  }, [params.provider, params.walletAddress, params.setChainId, params.setNativeBalance, params.setNetworkName]);
}
