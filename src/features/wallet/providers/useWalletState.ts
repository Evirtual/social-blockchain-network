import { useContext } from "react";
import { WalletStateContext } from "./walletStateContext";

export function useWalletState() {
  const ctx = useContext(WalletStateContext);
  if (!ctx) throw new Error("useWalletState must be used within <WalletProvider>");
  return ctx;
}
