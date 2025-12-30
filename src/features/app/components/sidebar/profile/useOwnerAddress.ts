import { useEffect, useMemo, useState } from "react";

import { useContractActions } from "@features/contract";

export function useOwnerAddress(walletAddress: string | null) {
  const contract = useContractActions();
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress) {
      setOwnerAddress(null);
      return;
    }

    void (async () => {
      try {
        const readContract = await contract.getReadContract();
        const owner = (await (readContract as any).owner()) as string;
        if (!cancelled) setOwnerAddress(owner);
      } catch {
        if (!cancelled) setOwnerAddress(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contract, walletAddress]);

  const isOwner = useMemo(() => {
    if (!walletAddress || !ownerAddress) return false;
    return walletAddress.toLowerCase() === ownerAddress.toLowerCase();
  }, [ownerAddress, walletAddress]);

  return { ownerAddress, isOwner };
}
