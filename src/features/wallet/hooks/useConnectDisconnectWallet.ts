import { formatEther, type BrowserProvider } from "ethers";
import { useCallback } from "react";
import { writeWalletAutoConnectDisabled } from "./storage";

export function useConnectDisconnectWallet(params: {
  provider: BrowserProvider | null;
  setStatus: (v: string) => void;
  setWalletAddress: (v: string | null) => void;
  setChainId: (v: string | null) => void;
  setNetworkName: (v: string | null) => void;
  setNativeBalance: (v: string) => void;
  setDisconnectedState: (statusMessage: string) => void;
  setIsWalletAutoConnectDisabled: (v: boolean) => void;
  bumpWalletEpoch: () => void;
}) {
  const connectWallet = useCallback(async (): Promise<string | null> => {
    try {
      if (!params.provider) {
        params.setStatus("Install a wallet like MetaMask to continue.");
        return null;
      }

      await params.provider.send("eth_requestAccounts", []);
      const signer = await params.provider.getSigner();
      const address = await signer.getAddress();
      const network = await params.provider.getNetwork();

      // User explicitly connected; re-enable auto-connect.
      params.setIsWalletAutoConnectDisabled(false);
      writeWalletAutoConnectDisabled(false);

      params.setWalletAddress(address);
      params.setChainId(network.chainId.toString());
      params.setNetworkName(network.name);
      params.setStatus("Wallet connected.");

      // Balance is a nice-to-have; don't block on it.
      try {
        const balanceWei = await params.provider.getBalance(address);
        params.setNativeBalance(Number(formatEther(balanceWei)).toFixed(4));
      } catch {
        params.setNativeBalance("—");
      }

      params.bumpWalletEpoch();
      return address;
    } catch {
      params.setStatus("Wallet connection rejected.");
      return null;
    }
  }, [params]);

  const disconnectWallet = useCallback(() => {
    // Wallet extensions (e.g. MetaMask) don't support a true programmatic disconnect.
    // This clears the app's local session state.
    params.setDisconnectedState("Wallet disconnected");

    params.setIsWalletAutoConnectDisabled(true);
    writeWalletAutoConnectDisabled(true);
  }, [params]);

  return { connectWallet, disconnectWallet };
}
