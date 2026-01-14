import { useCallback } from "react";
import { useContractActionsFacade } from "@features/contract";
import { useSocialActions } from "../providers/useSocialActions";

export function useTipWithRefresh() {
  const contract = useContractActionsFacade();
  const social = useSocialActions();

  return useCallback(
    async (
      tokenId: string,
      amountRaw: string,
      postChainId?: string | null,
      supportBps?: number | null,
      savePreference?: boolean
    ) => {
      const ok = await social.handleTip(tokenId, amountRaw, postChainId, supportBps, savePreference);
      if (!ok) return false;
      try {
        await contract.refreshContractState();
      } catch {
        // ignore
      }
      return true;
    },
    [social, contract]
  );
}
