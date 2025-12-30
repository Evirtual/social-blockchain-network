import { useCallback } from "react";
import { useContractActions } from "@features/contract";
import { useSocialActions } from "@features/social";

export function useTipWithRefresh() {
  const contract = useContractActions();
  const social = useSocialActions();

  return useCallback(
    async (tokenId: string, amountRaw: string, postChainId?: string | null) => {
      const ok = await social.handleTip(tokenId, amountRaw, postChainId);
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
