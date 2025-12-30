import { createContext } from "react";
import type { BrowserProvider } from "ethers";

export type WalletState = {
  provider: BrowserProvider | null;
  walletAddress: string | null;
  chainId: string | null;
  networkName: string | null;
  nativeBalance: string;

  walletEpoch: number;
};

export type WalletActions = {
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  refreshWalletPanel: () => Promise<void>;
};

export type WalletContextValue = WalletState & WalletActions;

const WalletStateContext = createContext<WalletState | null>(null);
const WalletActionsContext = createContext<WalletActions | null>(null);
const WalletContext = createContext<WalletContextValue | null>(null);

export { WalletStateContext, WalletActionsContext, WalletContext };
