import { formatEther, type BrowserProvider } from "ethers";
import { useCallback, useEffect, useRef } from "react";

export function useRefreshWalletPanel(params: {
  provider: BrowserProvider | null;
  walletAddress: string | null;
  setNetworkName: (v: string | null) => void;
  setChainId: (v: string | null) => void;
  setNativeBalance: (v: string) => void;
}) {
  const refreshWalletInFlightRef = useRef<Promise<void> | null>(null);
  const inFlightKeyRef = useRef<{ provider: BrowserProvider; walletAddress: string } | null>(null);
  const latestKeyRef = useRef<{ provider: BrowserProvider | null; walletAddress: string | null }>({
    provider: null,
    walletAddress: null
  });

  useEffect(() => {
    latestKeyRef.current = { provider: params.provider, walletAddress: params.walletAddress };
  }, [params.provider, params.walletAddress]);

  useEffect(() => {
    // If provider/account changes, don't let an old in-flight refresh block the new one.
    refreshWalletInFlightRef.current = null;
    inFlightKeyRef.current = null;
  }, [params.provider, params.walletAddress]);

  return useCallback(async () => {
    const provider = params.provider;
    if (!provider) return;
    const addr = params.walletAddress;
    if (!addr) return;

    const currentKey = { provider, walletAddress: addr };

    if (refreshWalletInFlightRef.current && inFlightKeyRef.current) {
      const inflight = inFlightKeyRef.current;
      const sameProvider = inflight.provider === provider;
      const sameAddress = inflight.walletAddress.toLowerCase() === addr.toLowerCase();
      if (sameProvider && sameAddress) {
        await refreshWalletInFlightRef.current;
        return;
      }
    }

    const task = (async () => {
      try {
        const [network, balanceWei] = await Promise.all([provider.getNetwork(), provider.getBalance(addr)]);
        const latest = latestKeyRef.current;
        const stillCurrent = latest.provider === provider && (latest.walletAddress ?? "").toLowerCase() === addr.toLowerCase();
        if (!stillCurrent) return;

        params.setNetworkName(network.name);
        params.setChainId(network.chainId.toString());
        params.setNativeBalance(Number(formatEther(balanceWei)).toFixed(4));
      } catch {
        // ignore
      }
    })();

    refreshWalletInFlightRef.current = task;
    inFlightKeyRef.current = currentKey;
    try {
      await task;
    } finally {
      if (refreshWalletInFlightRef.current === task) refreshWalletInFlightRef.current = null;
      if (inFlightKeyRef.current?.provider === provider) inFlightKeyRef.current = null;
    }
  }, [params.provider, params.walletAddress, params.setChainId, params.setNativeBalance, params.setNetworkName]);
}
