import { useContext } from "react";
import { WalletActionsContext } from "./walletStateContext";

export function useWalletActions() {
  const ctx = useContext(WalletActionsContext);
  if (!ctx) throw new Error("useWalletActions must be used within <WalletProvider>");
  return ctx;
}
