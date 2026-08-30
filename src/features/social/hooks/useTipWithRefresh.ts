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
      const outcome = await social.handleTip(tokenId, amountRaw, postChainId, supportBps, savePreference);
      // The rejection reason is passed straight through so the dialog can show
      // it; refreshing contract state is only meaningful after a real tip.
      if (!outcome.ok) return outcome;
      try {
        await contract.refreshContractState();
      } catch {
        // ignore
      }
      return outcome;
    },
    [social, contract]
  );
}
