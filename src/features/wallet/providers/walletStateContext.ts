import { createContext } from "react";
import { createStableContext } from "@shared/lib/createStableContext";
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

const WalletStateContext = createStableContext("__sbnetWalletStateContext", () =>
  createContext<WalletState | null>(null)
);
const WalletActionsContext = createStableContext("__sbnetWalletActionsContext", () =>
  createContext<WalletActions | null>(null)
);
const WalletContext = createStableContext("__sbnetWalletContext", () =>
  createContext<WalletContextValue | null>(null)
);

export { WalletStateContext, WalletActionsContext, WalletContext };
