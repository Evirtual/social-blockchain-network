import { useCallback } from "react";

import { getNetworkBadgeLabel } from "@shared/lib/chain";

export function useEnsureMatchingNetwork(chainId: string | null, setStatus: (value: string) => void) {
  return useCallback(
    (postChainId?: string | null) => {
      if (!postChainId) return true;
      if (!chainId) return true;
      if (postChainId === chainId) return true;

      setStatus(`Wrong network. Switch to ${getNetworkBadgeLabel(postChainId)} to interact with this post.`);
      return false;
    },
    [chainId, setStatus]
  );
}
