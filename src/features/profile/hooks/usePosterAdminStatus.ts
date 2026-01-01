import { useEffect, useState } from "react";
import { isAddress } from "ethers";
import { fetchPosterStatuses } from "@shared/lib/posterStatus";
import { onPosterAllowedChanged } from "@shared/lib/posterAllowedEvents";

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
    if (!contract.isOwner || !isAddress(address)) {
      setIsPosterAllowed(undefined);
      setWasPosterDisapprovedEver(undefined);
      return;
    }

    const off = onPosterAllowedChanged((detail) => {
      const target = address.toLowerCase();
      if (String(detail.address ?? "").trim().toLowerCase() !== target) return;
      setIsPosterAllowed(!!detail.allowed);
      if (detail.disapprovedEver === true) setWasPosterDisapprovedEver(true);
    });

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
      off();
    };
  }, [
    address,
    contract.isOwner,
    contract.ensureContractDeployedOnCurrentNetwork,
    contract.getReadContract
  ]);

  return {
    isPosterAllowed,
    setIsPosterAllowed,
    wasPosterDisapprovedEver,
    setWasPosterDisapprovedEver
  };
}
