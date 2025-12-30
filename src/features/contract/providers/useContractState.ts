import { useContext } from "react";
import { ContractStateContext } from "./contractStateContext";

export function useContractState() {
  const ctx = useContext(ContractStateContext);
  if (!ctx) throw new Error("useContractState must be used within <ContractProvider>");
  return ctx;
}
