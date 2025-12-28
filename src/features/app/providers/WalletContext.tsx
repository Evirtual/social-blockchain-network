import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BrowserProvider } from "ethers";
import { useStatus } from "./StatusContext";
import {
  readWalletAutoConnectDisabled,
  useConnectDisconnectWallet,
  useEip1193Provider,
  useRefreshWalletPanel,
  useWalletBootstrap,
  useWalletEvents
} from "../../wallet";

export type WalletContextValue = {
  provider: BrowserProvider | null;
  walletAddress: string | null;
  chainId: string | null;
  networkName: string | null;
  nativeBalance: string;

  walletEpoch: number;

  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  refreshWalletPanel: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { setStatus } = useStatus();

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>("—");

  // Bump when account/chain changes so other contexts can react.
  const [walletEpoch, setWalletEpoch] = useState<number>(0);

  // Ethers BrowserProvider caches network info. When the wallet network changes,
  // recreate the provider so reads use the new chain immediately.
  const [providerNonce, setProviderNonce] = useState<number>(0);

  const [isWalletAutoConnectDisabled, setIsWalletAutoConnectDisabled] = useState<boolean>(() =>
    readWalletAutoConnectDisabled()
  );

  const provider = useEip1193Provider(providerNonce) as BrowserProvider | null;

  const setDisconnectedState = useCallback(
    (statusMessage: string) => {
      setWalletAddress(null);
      setNativeBalance("—");
      setStatus(statusMessage);
      setWalletEpoch((n) => n + 1);
    },
    [setStatus]
  );

  const refreshWalletPanel = useRefreshWalletPanel({
    provider,
    walletAddress,
    setNetworkName,
    setChainId,
    setNativeBalance
  });

  const { connectWallet, disconnectWallet } = useConnectDisconnectWallet({
    provider,
    setStatus,
    setWalletAddress,
    setChainId,
    setNetworkName,
    setNativeBalance,
    setDisconnectedState,
    setIsWalletAutoConnectDisabled,
    bumpWalletEpoch: () => setWalletEpoch((n) => n + 1)
  });

  useWalletBootstrap({
    provider,
    isWalletAutoConnectDisabled,
    setChainId,
    setNetworkName,
    setWalletAddress,
    setDisconnectedState,
    setStatus,
    bumpWalletEpoch: () => setWalletEpoch((n) => n + 1)
  });

  useWalletEvents({
    provider,
    isWalletAutoConnectDisabled,
    setDisconnectedState,
    setWalletAddress,
    setNativeBalance,
    setChainId,
    setNetworkName,
    setStatus,
    bumpProviderNonce: () => setProviderNonce((n) => n + 1),
    bumpWalletEpoch: () => setWalletEpoch((n) => n + 1)
  });

  useEffect(() => {
    // Auto-load balance on initial page load (auto-connect) and when switching accounts.
    // The callback itself is provider-aware and de-duped.
    if (!provider) return;
    if (!walletAddress) return;
    void refreshWalletPanel();
  }, [provider, walletAddress, refreshWalletPanel]);

  const value = useMemo<WalletContextValue>(
    () => ({
      provider,
      walletAddress,
      chainId,
      networkName,
      nativeBalance,
      walletEpoch,
      connectWallet,
      disconnectWallet,
      refreshWalletPanel
    }),
    [
      provider,
      walletAddress,
      chainId,
      networkName,
      nativeBalance,
      walletEpoch,
      connectWallet,
      disconnectWallet,
      refreshWalletPanel
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}
