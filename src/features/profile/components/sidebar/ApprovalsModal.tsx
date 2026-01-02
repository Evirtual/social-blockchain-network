import { useCallback, useEffect, useMemo, useState } from "react";

import { Modal } from "@shared/components/Modal";
import { useContractActionsFacade, useContractState } from "@features/contract";
import { useFeedState } from "@features/feed";
import { useWalletState } from "@features/wallet";
import { useApprovalActions, useOnChainApprovalRequests, usePosterStatusMaps } from "./approvals";
import type { ApprovalRow } from "./approvals/types";
import { PendingApprovalsSection } from "./approvals/PendingApprovalsSection";
import { ChainRequestsSection } from "./approvals/ChainRequestsSection";
import { useOwnerAddress } from "@features/profile";
import { normalizeAddress } from "@shared/lib/address";

export type ApprovalsModalProps = {
  open: boolean;
  isOwner: boolean;
  onClose: () => void;
  shortAddress: (address: string) => string;
  headerLeading?: React.ReactNode;
};

export function ApprovalsModal(props: ApprovalsModalProps) {
  const contractState = useContractState();
  const contractActions = useContractActionsFacade();
  const { runContractTx } = contractActions;
  const feed = useFeedState();
  const wallet = useWalletState();
  const { ownerAddress } = useOwnerAddress(wallet.walletAddress);

  const [pendingApprovals, setPendingApprovals] = useState<string[]>([]);
  const [pendingInput, setPendingInput] = useState("");
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<{ addr: string; action: "approve" | "disapprove" | "reset" } | null>(
    null
  );

  useEffect(() => {
    if (!props.open) return;
    setApprovalsError(null);
    setPendingInput("");
    setActionInFlight(null);
  }, [props.open]);

  const { onChainRequests, isLoadingOnChainRequests, onChainRequestsLoadError } = useOnChainApprovalRequests({
    open: props.open,
    isOwner: props.isOwner,
    chainId: wallet.chainId,
    contractAddress: contractState.contractAddress,
    getReadContract: contractActions.getReadContract
  });

  const {
    posterAllowedByAddress,
    posterDisapprovedEverByAddress,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress,
    isLoadingPosterStatuses
  } = usePosterStatusMaps({
    open: props.open,
    isOwner: props.isOwner,
    pendingApprovals,
    onChainRequests,
    getReadContract: contractActions.getReadContract,
    chainId: wallet.chainId
  });

  const { addPendingApproval, removePending, approvePending, disapprovePending, resetAllAndBlock } = useApprovalActions({
    pendingApprovals,
    setPendingApprovals,
    setApprovalsError,
    setPendingInput,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress,
    runContractTx,
    getReadContract: contractActions.getReadContract,
    getWriteContract: contractActions.getWriteContract,
    feedPosts: feed.posts
  });

  const pendingRows = useMemo<ApprovalRow[]>(() => {
    return pendingApprovals.map((addr) => {
      const key = normalizeAddress(addr);
      return {
        addr,
        key,
        isFlagged: !!posterDisapprovedEverByAddress[key],
        isAllowed: !!posterAllowedByAddress[key]
      };
    });
  }, [pendingApprovals, posterDisapprovedEverByAddress, posterAllowedByAddress]);

  const chainRows = useMemo<ApprovalRow[]>(() => {
    const ownerLower = normalizeAddress(ownerAddress);
    return onChainRequests
      .filter((addr) => normalizeAddress(addr) !== ownerLower)
      .map((addr) => {
        const key = normalizeAddress(addr);
        return {
          addr,
          key,
          isFlagged: !!posterDisapprovedEverByAddress[key],
          isAllowed: !!posterAllowedByAddress[key]
        };
      });
  }, [onChainRequests, posterDisapprovedEverByAddress, posterAllowedByAddress, ownerAddress]);

  const handleRemove = useCallback(
    (addr: string) => {
      removePending(addr);
    },
    [removePending]
  );

  const handleApprove = useCallback(
    async (addr: string) => {
      if (actionInFlight) return;
      setActionInFlight({ addr, action: "approve" });
      try {
        await approvePending(addr);
      } finally {
        setActionInFlight(null);
      }
    },
    [approvePending, actionInFlight]
  );

  const handleDisapprove = useCallback(
    async (addr: string) => {
      if (actionInFlight) return;
      setActionInFlight({ addr, action: "disapprove" });
      try {
        await disapprovePending(addr);
      } finally {
        setActionInFlight(null);
      }
    },
    [disapprovePending, actionInFlight]
  );

  const handleReset = useCallback(
    async (addr: string) => {
      if (actionInFlight) return;
      setActionInFlight({ addr, action: "reset" });
      try {
        await resetAllAndBlock(addr);
      } finally {
        setActionInFlight(null);
      }
    },
    [resetAllAndBlock, actionInFlight]
  );

  return (
    <Modal open={props.open} title="Approvals" headerLeading={props.headerLeading} onClose={props.onClose}>
      <div className="composer approvalsModal">
        <div className="muted">Approve wallets that are allowed to mint posts during testing.</div>

        <PendingApprovalsSection
          pendingInput={pendingInput}
          onPendingInputChange={setPendingInput}
          onAdd={() => addPendingApproval(pendingInput)}
          approvalsError={approvalsError}
          pendingRows={pendingRows}
          shortAddress={props.shortAddress}
          isLoadingPosterStatuses={isLoadingPosterStatuses}
          actionInFlight={actionInFlight}
          onRemove={handleRemove}
          onApprove={handleApprove}
          onDisapprove={handleDisapprove}
          onReset={handleReset}
        />

        <ChainRequestsSection
          isOwner={props.isOwner}
          isLoadingOnChainRequests={isLoadingOnChainRequests}
          onChainRequestsLoadError={onChainRequestsLoadError}
          chainRows={chainRows}
          shortAddress={props.shortAddress}
          isLoadingPosterStatuses={isLoadingPosterStatuses}
          actionInFlight={actionInFlight}
          onApprove={handleApprove}
          onDisapprove={handleDisapprove}
          onReset={handleReset}
        />
      </div>
    </Modal>
  );
}
