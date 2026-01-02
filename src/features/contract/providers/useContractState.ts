import { useContext } from "react";
import { requireContext } from "@shared/lib";
import { ContractStateContext } from "./contractStateContext";

export function useContractState() {
  const ctx = useContext(ContractStateContext);
  return requireContext(ctx, "useContractState", "ContractProvider");
}
