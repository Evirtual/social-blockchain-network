import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPosterGateStatuses, fetchPosterStatuses } from "@shared/lib/posterStatus";
import { runInFlight } from "@shared/lib/inFlight";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import type { TransactionResponse } from "ethers";
import type { ReadContractFactory, WriteContractFactory } from "@features/contract/types";

type ContractLike = {
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;
};

export function usePosterApproval(params: {
  walletAddress: string | null;
  contract: ContractLike;
  setStatus: (s: string) => void;
  runContractTx: <T = void>(label: string, txFn: () => Promise<TransactionResponse>) => Promise<T | undefined>;
}) {
  const { walletAddress, contract, setStatus, runContractTx } = params;

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);
  const [isApprovalLoading, setIsApprovalLoading] = useState(false);
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

    void pollOnce();
    const t = window.setInterval(() => void pollOnce(), 3500);

    return () => {
      cancelled = true;
      window.clearInterval(t);
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

    if (isApprovalLoading) return;
    if (approvalRequested) {
      setStatus("Approval already requested. Please wait for an admin to approve your wallet.");
      return;
    }

    try {
      setIsApprovalLoading(true);
      await runContractTx("Request posting approval", async () => {
        const writeContract = await contract.getWriteContract();
        return writeContract.requestPosterApproval();
      });
    } catch {
      setIsApprovalLoading(false);
      return;
    }

    setApprovalRequired(true);
    setApprovalRequested(true);
    setIsApprovalLoading(false);
    setStatus("Approval requested. An admin must approve your wallet before you can post.");
  }, [walletAddress, isApprovalLoading, approvalRequested, runContractTx, contract, setStatus]);

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
      isApprovalLoading,
      setApprovalRequired,
      setApprovalRequested,
      dismissApproval,
      requestApproval,
      checkPosterAllowed
    }),
    [approvalRequired, approvalRequested, isApprovalLoading, dismissApproval, requestApproval, checkPosterAllowed]
  );
}
