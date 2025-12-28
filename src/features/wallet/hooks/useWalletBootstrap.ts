import { useEffect } from "react";
import type { BrowserProvider } from "ethers";

export function useWalletBootstrap(params: {
  provider: BrowserProvider | null;
  isWalletAutoConnectDisabled: boolean;
  setChainId: (v: string | null) => void;
  setNetworkName: (v: string | null) => void;
  setWalletAddress: (v: string | null) => void;
  setDisconnectedState: (statusMessage: string) => void;
  setStatus: (v: string) => void;
  bumpWalletEpoch: () => void;
}) {
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        if (!params.provider) return;

        // Always resolve chain info on page load.
        try {
          const network = await params.provider.getNetwork();
          if (cancelled) return;
          params.setChainId(network.chainId.toString());
          params.setNetworkName(network.name);
        } catch {
          // ignore
        }

        const accounts = (await params.provider.send("eth_accounts", [])) as string[];
        const addr = params.isWalletAutoConnectDisabled ? null : (accounts?.[0] ?? null);
        if (!addr) {
          if (cancelled) return;
          params.setDisconnectedState("Wallet disconnected");
          return;
        }

        if (cancelled) return;
        params.setWalletAddress(addr);
        const network = await params.provider.getNetwork();
        if (cancelled) return;
        params.setChainId(network.chainId.toString());
        params.setNetworkName(network.name);
        params.setStatus("Wallet connected.");

        params.bumpWalletEpoch();
      } catch {
        // ignore
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    params.provider,
    params.isWalletAutoConnectDisabled,
    params.setChainId,
    params.setNetworkName,
    params.setWalletAddress,
    params.setDisconnectedState,
    params.setStatus,
    params.bumpWalletEpoch
  ]);
}
