import { useContext } from "react";
import { requireContext } from "@shared/lib";
import { WalletActionsContext } from "./walletStateContext";

export function useWalletActions() {
  const ctx = useContext(WalletActionsContext);
  return requireContext(ctx, "useWalletActions", "WalletProvider");
}
