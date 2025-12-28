import { useEffect, useState } from "react";
import { isAddress } from "ethers";
import { fetchPosterStatuses } from "@shared/lib/posterStatus";

type ContractLike = {
  isOwner: boolean;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

export function usePosterAdminStatus(params: { contract: ContractLike; address: string }) {
  const { contract, address } = params;

  const [isPosterAllowed, setIsPosterAllowed] = useState<boolean | undefined>(undefined);
  const [wasPosterDisapprovedEver, setWasPosterDisapprovedEver] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!contract.isOwner) return;
    if (!isAddress(address)) return;

    let cancelled = false;
    void (async () => {
      try {
        await contract.ensureContractDeployedOnCurrentNetwork();
        const readContract = await contract.getReadContract();
        const statuses = await fetchPosterStatuses(readContract, [address]);
        const first = statuses[0];
        const allowed = first?.allowed ?? false;
        const disapprovedEver = first?.disapprovedEver ?? false;
        if (cancelled) return;
        setIsPosterAllowed(allowed);
        setWasPosterDisapprovedEver(disapprovedEver);
      } catch {
        if (cancelled) return;
        setIsPosterAllowed(undefined);
        setWasPosterDisapprovedEver(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, contract]);

  return {
    isPosterAllowed,
    setIsPosterAllowed,
    wasPosterDisapprovedEver,
    setWasPosterDisapprovedEver
  };
}
