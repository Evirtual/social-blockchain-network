import type { BrowserProvider } from "ethers";
import { useCallback } from "react";
import { getSocialContract } from "../contracts/socialPosts";

export function useRefreshOwner(params: {
  provider: BrowserProvider | null;
  contractAddress: string | undefined;
  setOwnerAddress: (v: string | null) => void;
}) {
  return useCallback(async () => {
    if (!params.provider) {
      params.setOwnerAddress(null);
      return;
    }

    const addr = params.contractAddress;
    if (!addr) {
      params.setOwnerAddress(null);
      return;
    }

    try {
      const readContract = getSocialContract(addr, params.provider);
      const o = (await (readContract as any).owner()) as string;
      params.setOwnerAddress(o);
    } catch {
      params.setOwnerAddress(null);
    }
  }, [params.provider, params.contractAddress, params.setOwnerAddress]);
}
