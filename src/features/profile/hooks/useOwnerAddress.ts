import { useEffect, useMemo, useState } from "react";

import { useContractActionsFacade } from "@features/contract";
import { normalizeAddress } from "@shared/lib/address";

export function useOwnerAddress(walletAddress: string | null) {
  const contract = useContractActionsFacade();
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [isLoadingOwner, setIsLoadingOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress) {
      setOwnerAddress(null);
      setIsLoadingOwner(false);
      return;
    }

    void (async () => {
      setIsLoadingOwner(true);
      try {
        const readContract = await contract.getReadContract();
        const owner = (await readContract.owner()) as string;
        if (!cancelled) setOwnerAddress(owner);
      } catch {
        if (!cancelled) setOwnerAddress(null);
      } finally {
        if (!cancelled) setIsLoadingOwner(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contract, walletAddress]);

  const isOwner = useMemo(() => {
    if (!walletAddress || !ownerAddress) return false;
    return normalizeAddress(walletAddress) === normalizeAddress(ownerAddress);
  }, [ownerAddress, walletAddress]);

  return { ownerAddress, isOwner, isLoadingOwner };
}
