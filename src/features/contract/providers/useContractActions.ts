import { useContext } from "react";
import { requireContext } from "@shared/lib/reactContext";
import { ContractActionsContext } from "./contractStateContext";

export function useContractActions() {
  const ctx = useContext(ContractActionsContext);
  return requireContext(ctx, "useContractActions", "ContractProvider");
}
