import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, formatEther } from "ethers";
import { readWalletAutoConnectDisabled, writeWalletAutoConnectDisabled } from "../hooks/storage";
import { useStatusActions } from "@features/status";
import { ConnectWalletModal } from "../components/ConnectWalletModal";
import {
  WalletActionsContext,
  WalletContext,
  WalletStateContext,
  type WalletActions,
  type WalletContextValue,
  type WalletState
} from "./walletStateContext";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type Eip1193Window = Window & {
  ethereum?: Eip1193Provider;
};

function getEthereum(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return (window as Eip1193Window).ethereum ?? null;
}

function parseChainId(chainIdValue: unknown): number | null {
  if (typeof chainIdValue === "number") return chainIdValue;
  if (typeof chainIdValue === "string") {
    const normalized = chainIdValue.startsWith("0x") ? chainIdValue.slice(2) : chainIdValue;
    const parsed = Number.parseInt(normalized, 16);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getChainName(chainId: number): string | null {
  switch (chainId) {
    case 1:
      return "Ethereum";
    case 5:
      return "Goerli";
    case 11155111:
      return "Sepolia";
    case 8453:
      return "Base";
    case 84532:
      return "Base Sepolia";
    case 56:
      return "BNB Chain";
    case 97:
      return "BNB Testnet";
    case 31337:
      return "Hardhat";
    default:
      return "Unknown";
  }
}

function formatBalance(balance: bigint): string {
  const formatted = formatEther(balance);
  const value = Number(formatted);
  if (!Number.isFinite(value)) return "?";
  return value.toFixed(4);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { setStatus } = useStatusActions();

  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>("?");
  const [walletEpoch, setWalletEpoch] = useState<number>(0);

  const providerRef = useRef<BrowserProvider | null>(null);
  const ethereumRef = useRef<Eip1193Provider | null>(null);
  const listenersRef = useRef<{
    accountsChanged: (accounts: unknown) => void;
    chainChanged: (chainIdValue: unknown) => void;
  } | null>(null);

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectorAvailability, setConnectorAvailability] = useState<Record<string, boolean>>({});
  const connectResolverRef = useRef<((value: string | null) => void) | null>(null);

  const networkName = useMemo(() => {
    if (!chainId) return null;
    const chainIdNum = Number(chainId);
    if (!Number.isFinite(chainIdNum)) return null;
    return getChainName(chainIdNum);
  }, [chainId]);

  const cleanupListeners = useCallback(() => {
    const ethereum = ethereumRef.current;
    const listeners = listenersRef.current;
    if (!ethereum || !listeners || !ethereum.removeListener) {
      listenersRef.current = null;
      return;
    }

    ethereum.removeListener("accountsChanged", listeners.accountsChanged);
    ethereum.removeListener("chainChanged", listeners.chainChanged);
    listenersRef.current = null;
  }, []);

  const clearWalletState = useCallback(() => {
    cleanupListeners();
    providerRef.current = null;
    ethereumRef.current = null;
    setProvider(null);
    setWalletAddress(null);
    setChainId(null);
    setNativeBalance("?");
  }, [cleanupListeners]);

  const refreshWalletPanel = useCallback(async (addressOverride?: string | null) => {
    const address = addressOverride ?? walletAddress;
    if (!providerRef.current || !address) return;
    try {
      const balance = await providerRef.current.getBalance(address);
      setNativeBalance(formatBalance(balance));
    } catch {
      // ignore
    }
  }, [walletAddress]);

  const setupListeners = useCallback(
    (ethereum: Eip1193Provider) => {
      if (!ethereum.on) return;

      const accountsChanged = (accountsValue: unknown) => {
        if (!Array.isArray(accountsValue)) return;
        const nextAddress = typeof accountsValue[0] === "string" ? accountsValue[0] : null;
        if (!nextAddress) {
          clearWalletState();
          setStatus("Wallet disconnected");
          return;
        }
        setWalletAddress(nextAddress);
        void refreshWalletPanel(nextAddress);
      };

      const chainChanged = (chainIdValue: unknown) => {
        const parsedChainId = parseChainId(chainIdValue);
        if (parsedChainId === null) return;

        // Recreate the ethers BrowserProvider on network switch.
        // Ethers can cache the network on the provider instance, which can lead to
        // reads continuing against the previous chain until a full page refresh.
        const nextProvider = new BrowserProvider(ethereum);
        providerRef.current = nextProvider;
        setProvider(nextProvider);

        setChainId(String(parsedChainId));
        void refreshWalletPanel();
      };

      ethereum.on("accountsChanged", accountsChanged);
      ethereum.on("chainChanged", chainChanged);
      listenersRef.current = { accountsChanged, chainChanged };
    },
    [clearWalletState, refreshWalletPanel, setStatus]
  );

  useEffect(() => {
    if (!isConnectModalOpen) return;
    setConnectorAvailability({ injected: Boolean(getEthereum()) });
  }, [isConnectModalOpen]);

  useEffect(() => {
    let active = true;

    const autoConnect = async () => {
      if (walletAddress) return;
      if (readWalletAutoConnectDisabled()) return;
      const ethereum = getEthereum();
      if (!ethereum) return;

      try {
        const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[] | undefined;
        const nextAddress = accounts?.[0] ?? null;
        if (!nextAddress || !active) return;

        const chainIdValue = await ethereum.request({ method: "eth_chainId" });
        const parsedChainId = parseChainId(chainIdValue);

        const nextProvider = new BrowserProvider(ethereum);
        providerRef.current = nextProvider;
        ethereumRef.current = ethereum;
        setProvider(nextProvider);
        setWalletAddress(nextAddress);
        setChainId(parsedChainId ? String(parsedChainId) : null);

        cleanupListeners();
        setupListeners(ethereum);

        await refreshWalletPanel(nextAddress);
      } catch {
        // ignore
      }
    };

    void autoConnect();

    return () => {
      active = false;
    };
  }, [cleanupListeners, refreshWalletPanel, setupListeners, walletAddress]);

  useEffect(() => {
    if (!provider || !walletAddress) {
      setNativeBalance("?");
      return;
    }
    void refreshWalletPanel(walletAddress);
  }, [provider, walletAddress, refreshWalletPanel]);

  useEffect(() => {
    setWalletEpoch((value) => value + 1);
    if (walletAddress) {
      setStatus("Wallet connected.");
    } else {
      setStatus("Wallet disconnected");
    }
  }, [walletAddress, chainId, setStatus]);

  const resolveConnect = useCallback((value: string | null) => {
    if (!connectResolverRef.current) return;
    connectResolverRef.current(value);
    connectResolverRef.current = null;
  }, []);

  const closeConnectModal = useCallback(() => {
    setIsConnectModalOpen(false);
    setConnectError(null);
    resolveConnect(null);
  }, [resolveConnect]);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (walletAddress) return walletAddress;
    writeWalletAutoConnectDisabled(false);
    setConnectError(null);
    setIsConnectModalOpen(true);
    return new Promise((resolve) => {
      connectResolverRef.current = resolve;
    });
  }, [walletAddress]);

  const handleSelectConnector = useCallback(async (connectorId: string) => {
    if (connectorId !== "injected") return;
    const ethereum = getEthereum();
    if (!ethereum) {
      setConnectError("No browser wallet detected.");
      return;
    }

    setIsConnecting(true);
    setConnectError(null);
    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[] | undefined;
      const nextAddress = accounts?.[0] ?? null;
      if (!nextAddress) {
        setConnectError("Wallet connection rejected.");
        setIsConnecting(false);
        return;
      }

      const chainIdValue = await ethereum.request({ method: "eth_chainId" });
      const parsedChainId = parseChainId(chainIdValue);

      const nextProvider = new BrowserProvider(ethereum);
      providerRef.current = nextProvider;
      ethereumRef.current = ethereum;
      setProvider(nextProvider);
      setWalletAddress(nextAddress);
      setChainId(parsedChainId ? String(parsedChainId) : null);

      cleanupListeners();
      setupListeners(ethereum);

      await refreshWalletPanel(nextAddress);

      setIsConnectModalOpen(false);
      resolveConnect(nextAddress);
    } catch {
      setConnectError("Wallet connection rejected.");
    } finally {
      setIsConnecting(false);
    }
  }, [cleanupListeners, refreshWalletPanel, resolveConnect, setupListeners]);

  const disconnectWallet = useCallback(() => {
    writeWalletAutoConnectDisabled(true);
    clearWalletState();
    setStatus("Wallet disconnected");
  }, [clearWalletState, setStatus]);

  const connectorOptions = useMemo(() => {
    const installed = connectorAvailability.injected;
    const badgeTone: "installed" | "unavailable" = installed ? "installed" : "unavailable";
    return [
      {
        id: "injected",
        name: "Browser Wallet",
        description: "Use your browser wallet extension.",
        badge: installed ? "Installed" : "Not installed",
        badgeTone,
        disabled: !installed
      }
    ];
  }, [connectorAvailability.injected]);

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
        <WalletContext.Provider value={value}>
          {children}
          <ConnectWalletModal
            open={isConnectModalOpen}
            isBusy={isConnecting}
            error={connectError}
            onClose={closeConnectModal}
            onSelect={handleSelectConnector}
            options={connectorOptions}
          />
        </WalletContext.Provider>
      </WalletActionsContext.Provider>
    </WalletStateContext.Provider>
  );
}
