import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPosterGateStatuses, fetchPosterStatuses } from "@shared/lib/posterStatus";
import { runInFlight } from "@shared/lib/inFlight";
import { requestConnectNudge } from "@shared/lib/connectNudge";

type ContractLike = {
  getReadContract: () => Promise<any>;
  getWriteContract: () => Promise<any>;
};

export function usePosterApproval(params: {
  walletAddress: string | null;
  contract: ContractLike;
  setStatus: (s: string) => void;
  runContractTx: (label: string, txFn: () => Promise<any>) => Promise<any>;
}) {
  const { walletAddress, contract, setStatus, runContractTx } = params;

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);
  const approvalPollInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  useEffect(() => {
    if (!walletAddress) return;
    if (!approvalRequested) return;

    let cancelled = false;

    const pollOnce = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      try {
        const key = walletAddress.toLowerCase();
        await runInFlight(approvalPollInFlightRef.current, key, async () => {
          const readContract = await contract.getReadContract();
          const statuses = await fetchPosterStatuses(readContract, [walletAddress]);
          const allowed = statuses[0]?.allowed ?? false;
          if (!allowed) return;
          if (cancelled) return;
          setApprovalRequired(false);
          setApprovalRequested(false);
          setStatus("You’ve been approved. You can post now.");
        });
      } catch {
        // ignore
      }
    };

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void pollOnce();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    void pollOnce();
    const t = window.setInterval(() => void pollOnce(), 3500);

    return () => {
      cancelled = true;
      window.clearInterval(t);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [walletAddress, approvalRequested, contract, setStatus]);

  const dismissApproval = useCallback(() => {
    setApprovalRequired(false);
    setApprovalRequested(false);
  }, []);

  const requestApproval = useCallback(async () => {
    if (!walletAddress) {
      requestConnectNudge();
      setStatus("Connect your wallet first.");
      return;
    }

    if (approvalRequested) {
      setStatus("Approval already requested. Please wait for an admin to approve your wallet.");
      return;
    }

    try {
      await runContractTx("Request posting approval", async () => {
        const writeContract = await contract.getWriteContract();
        return (writeContract as any).requestPosterApproval();
      });
    } catch {
      return;
    }

    setApprovalRequired(true);
    setApprovalRequested(true);
    setStatus("Approval requested. An admin must approve your wallet before you can post.");
  }, [walletAddress, approvalRequested, runContractTx, contract, setStatus]);

  const checkPosterAllowed = useCallback(
    async (addr: string) => {
      const readContract = await contract.getReadContract();
      const statuses = await fetchPosterGateStatuses(readContract, [addr]);
      const allowed = statuses[0]?.allowed ?? false;
      const requested = statuses[0]?.requested ?? false;
      return { allowed, requested };
    },
    [contract]
  );

  return useMemo(
    () => ({
      approvalRequired,
      approvalRequested,
      setApprovalRequired,
      setApprovalRequested,
      dismissApproval,
      requestApproval,
      checkPosterAllowed
    }),
    [approvalRequired, approvalRequested, dismissApproval, requestApproval, checkPosterAllowed]
  );
}
