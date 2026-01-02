import { useEffect, useMemo, useState } from "react";

import { useContractActions } from "@features/contract";
import { normalizeAddress } from "@shared/lib/address";

export function useOwnerAddress(walletAddress: string | null) {
  const { getReadContract } = useContractActions();
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
        const readContract = await getReadContract();
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
  }, [getReadContract, walletAddress]);

  const isOwner = useMemo(() => {
    if (!walletAddress || !ownerAddress) return false;
    return normalizeAddress(walletAddress) === normalizeAddress(ownerAddress);
  }, [ownerAddress, walletAddress]);

  return { ownerAddress, isOwner, isLoadingOwner };
}
