import type { BrowserProvider } from "ethers";
import { useCallback } from "react";
import { getSocialContract } from "../contracts/socialPosts";

export function useContractGetters(params: {
  provider: BrowserProvider | null;
  requireContractAddress: () => string;
}) {
  const getWriteContract = useCallback(async () => {
    if (!params.provider) throw new Error("Wallet not found.");
    const signer = await params.provider.getSigner();
    const address = params.requireContractAddress();
    return getSocialContract(address, signer);
  }, [params.provider, params.requireContractAddress]);

  const getReadContract = useCallback(async () => {
    if (!params.provider) throw new Error("Wallet not found.");
    const address = params.requireContractAddress();
    return getSocialContract(address, params.provider);
  }, [params.provider, params.requireContractAddress]);

  return { getReadContract, getWriteContract };
}
