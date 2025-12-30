import { useContext } from "react";
import { ContractActionsContext } from "./contractStateContext";

export function useContractActions() {
  const ctx = useContext(ContractActionsContext);
  if (!ctx) throw new Error("useContractActions must be used within <ContractProvider>");
  return ctx;
}
