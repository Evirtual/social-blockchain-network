import { useContractActions } from "../providers/useContractActions";
import { useContractTx } from "./useContractTx";

export function useContractActionsFacade() {
  const actions = useContractActions();
  const { runContractTx } = useContractTx();

  return {
    ...actions,
    runContractTx
  };
}
