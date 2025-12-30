import { useCallback, useEffect, useMemo, useState } from "react";
import type { BrowserProvider } from "ethers";
import {
  readWalletAutoConnectDisabled,
  useConnectDisconnectWallet,
  useEip1193Provider,
  useRefreshWalletPanel,
  useWalletBootstrap,
  useWalletEvents
} from "../hooks";
import { useStatusActions } from "@features/status";
import {
  WalletActionsContext,
  WalletContext,
  WalletStateContext,
  type WalletActions,
  type WalletContextValue,
  type WalletState
} from "./walletStateContext";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { setStatus } = useStatusActions();

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>("?");

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
      setNativeBalance("?");
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

  const stateValue = useMemo<WalletState>(
    () => ({
      provider,
      walletAddress,
      chainId,
      networkName,
      nativeBalance,
      walletEpoch
    }),
    [provider, walletAddress, chainId, networkName, nativeBalance, walletEpoch]
  );

  const actionsValue = useMemo<WalletActions>(
    () => ({
      connectWallet,
      disconnectWallet,
      refreshWalletPanel
    }),
    [connectWallet, disconnectWallet, refreshWalletPanel]
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      ...stateValue,
      ...actionsValue
    }),
    [stateValue, actionsValue]
  );

  return (
    <WalletStateContext.Provider value={stateValue}>
      <WalletActionsContext.Provider value={actionsValue}>
        <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
      </WalletActionsContext.Provider>
    </WalletStateContext.Provider>
  );
}
