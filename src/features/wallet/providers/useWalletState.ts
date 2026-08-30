import { useContext } from "react";
import { requireContext } from "@shared/lib/reactContext";
import { WalletStateContext } from "./walletStateContext";

export function useWalletState() {
  const ctx = useContext(WalletStateContext);
  return requireContext(ctx, "useWalletState", "WalletProvider");
}
