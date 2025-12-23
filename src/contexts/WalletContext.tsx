import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { useStatus } from "./StatusContext";

const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";

export type WalletContextValue = {
  provider: ethers.BrowserProvider | null;
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

  const provider = useMemo(() => {
    const ethereum = window.ethereum as ethers.Eip1193Provider | undefined;
    if (!ethereum) return null;
    return new ethers.BrowserProvider(ethereum);
  }, [providerNonce]);

  const refreshWalletPanel = useCallback(async () => {
    if (!provider || !walletAddress) return;
    if (refreshWalletInFlightRef.current) {
      await refreshWalletInFlightRef.current;
      return;
    }

    const task = (async () => {
      try {
        const [network, balanceWei] = await Promise.all([
          provider.getNetwork(),
          provider.getBalance(walletAddress)
        ]);
        setNetworkName(network.name);
        setChainId(network.chainId.toString());
        setNativeBalance(Number(ethers.formatEther(balanceWei)).toFixed(4));
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
  }, [provider, walletAddress]);

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
        setNativeBalance(Number(ethers.formatEther(balanceWei)).toFixed(4));
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
    setWalletAddress(null);
    setNativeBalance("—");
    setStatus("Wallet disconnected");

    setIsWalletAutoConnectDisabled(true);
    try {
      localStorage.setItem(WALLET_DISCONNECTED_KEY, "1");
    } catch {
      // ignore
    }

    setWalletEpoch((n) => n + 1);
  }, [setStatus]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (!provider) return;

        // Always resolve chain info on page load.
        try {
          const network = await provider.getNetwork();
          setChainId(network.chainId.toString());
          setNetworkName(network.name);
        } catch {
          // ignore
        }

        const accounts = (await provider.send("eth_accounts", [])) as string[];
        const addr = isWalletAutoConnectDisabled ? null : (accounts?.[0] ?? null);
        if (!addr) {
          setStatus("Wallet disconnected");
          return;
        }

        setWalletAddress(addr);
        const network = await provider.getNetwork();
        setChainId(network.chainId.toString());
        setNetworkName(network.name);
        setStatus("Wallet connected.");

        setWalletEpoch((n) => n + 1);
      } catch {
        // ignore
      }
    };

    void bootstrap();
  }, [provider, isWalletAutoConnectDisabled, setStatus]);

  useEffect(() => {
    if (!provider) return;
    const eth = (window.ethereum as any) ?? null;
    if (!eth?.on) return;

    const onAccountsChanged = async (accounts: string[]) => {
      if (isWalletAutoConnectDisabled) {
        setWalletAddress(null);
        setNativeBalance("—");
        setStatus("Wallet disconnected");
        setWalletEpoch((n) => n + 1);
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
        setStatus("Wallet disconnected");
        setWalletEpoch((n) => n + 1);
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
          const n = nextChainId.startsWith("0x") || nextChainId.startsWith("0X")
            ? Number.parseInt(nextChainId, 16)
            : Number.parseInt(nextChainId, 10);
          if (Number.isFinite(n)) setChainId(String(n));
          else setChainId(null);
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
    void refreshWalletPanel();
  }, [refreshWalletPanel]);

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
