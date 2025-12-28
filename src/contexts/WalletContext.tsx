import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, type Eip1193Provider, formatEther } from "ethers";
import { useStatus } from "./StatusContext";
import { parseChainIdNumber } from "../lib/chainId";

const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";

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

  const [isWalletAutoConnectDisabled, setIsWalletAutoConnectDisabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WALLET_DISCONNECTED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const refreshWalletInFlightRef = useRef<Promise<void> | null>(null);
  const walletAddressRef = useRef<string | null>(null);
  useEffect(() => {
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  const provider = useMemo(() => {
    const ethereum = window.ethereum as Eip1193Provider | undefined;
    if (!ethereum) return null;
    return new BrowserProvider(ethereum);
  }, [providerNonce]);

  const setDisconnectedState = useCallback(
    (statusMessage: string) => {
      setWalletAddress(null);
      setNativeBalance("—");
      setStatus(statusMessage);
      setWalletEpoch((n) => n + 1);
    },
    [setStatus]
  );

  const refreshWalletPanel = useCallback(async () => {
    if (!provider) return;
    const addr = walletAddressRef.current;
    if (!addr) return;
    if (refreshWalletInFlightRef.current) {
      await refreshWalletInFlightRef.current;
      return;
    }

    const task = (async () => {
      try {
        const [network, balanceWei] = await Promise.all([
          provider.getNetwork(),
          provider.getBalance(addr)
        ]);
        setNetworkName(network.name);
        setChainId(network.chainId.toString());
        setNativeBalance(Number(formatEther(balanceWei)).toFixed(4));
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
  }, [provider]);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    try {
      if (!provider) {
        setStatus("Install a wallet like MetaMask to continue.");
        return null;
      }

      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      // User explicitly connected; re-enable auto-connect.
      setIsWalletAutoConnectDisabled(false);
      try {
        localStorage.setItem(WALLET_DISCONNECTED_KEY, "0");
      } catch {
        // ignore
      }

      setWalletAddress(address);
      setChainId(network.chainId.toString());
      setNetworkName(network.name);
      setStatus("Wallet connected.");

      // Balance is a nice-to-have; don't block on it.
      try {
        const balanceWei = await provider.getBalance(address);
        setNativeBalance(Number(formatEther(balanceWei)).toFixed(4));
      } catch {
        setNativeBalance("—");
      }

      setWalletEpoch((n) => n + 1);
      return address;
    } catch {
      setStatus("Wallet connection rejected.");
      return null;
    }
  }, [provider, setStatus]);

  const disconnectWallet = useCallback(() => {
    // Wallet extensions (e.g. MetaMask) don't support a true programmatic disconnect.
    // This clears the app's local session state.
    setDisconnectedState("Wallet disconnected");

    setIsWalletAutoConnectDisabled(true);
    try {
      localStorage.setItem(WALLET_DISCONNECTED_KEY, "1");
    } catch {
      // ignore
    }
  }, [setDisconnectedState]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        if (!provider) return;

        // Always resolve chain info on page load.
        try {
          const network = await provider.getNetwork();
          if (cancelled) return;
          setChainId(network.chainId.toString());
          setNetworkName(network.name);
        } catch {
          // ignore
        }

        const accounts = (await provider.send("eth_accounts", [])) as string[];
        const addr = isWalletAutoConnectDisabled ? null : (accounts?.[0] ?? null);
        if (!addr) {
          if (cancelled) return;
          setDisconnectedState("Wallet disconnected");
          return;
        }

        if (cancelled) return;
        setWalletAddress(addr);
        const network = await provider.getNetwork();
        if (cancelled) return;
        setChainId(network.chainId.toString());
        setNetworkName(network.name);
        setStatus("Wallet connected.");

        setWalletEpoch((n) => n + 1);
      } catch {
        // ignore
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [provider, isWalletAutoConnectDisabled, setStatus]);

  useEffect(() => {
    if (!provider) return;
    const eth = (window.ethereum as any) ?? null;
    if (!eth?.on) return;

    const onAccountsChanged = async (accounts: string[]) => {
      if (isWalletAutoConnectDisabled) {
        setDisconnectedState("Wallet disconnected");
        return;
      }

      const addr = accounts?.[0] ?? null;
      setWalletAddress(addr);
      setNativeBalance("—");

      try {
        const network = await provider.getNetwork();
        setChainId(network.chainId.toString());
        setNetworkName(network.name);
      } catch {
        // ignore
      }

      if (!addr) {
        setDisconnectedState("Wallet disconnected");
        return;
      }

      setStatus("Wallet connected.");
      setWalletEpoch((n) => n + 1);
    };

    const onChainChanged = async (nextChainId?: string) => {
      try {
        setStatus("Network changed.");

        if (typeof nextChainId === "string" && nextChainId.length > 0) {
          // EIP-1193 chainChanged gives hex chainId.
          const n = parseChainIdNumber(nextChainId);
          setChainId(n == null ? null : String(n));
        }

        // Recreate provider to avoid stale network cache.
        setProviderNonce((n) => n + 1);
        setWalletEpoch((n) => n + 1);
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
  }, [provider, isWalletAutoConnectDisabled, setStatus]);

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
