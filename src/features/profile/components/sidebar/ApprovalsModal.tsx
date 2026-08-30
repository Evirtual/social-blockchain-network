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
import { buildApprovalRows } from "@features/profile/services/approvals";

export type ApprovalsModalProps = {
  open: boolean;
  isOwner: boolean;
  onClose: () => void;
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
  const [actionInFlight, setActionInFlight] = useState<{
    addr: string;
    action: "approve" | "disapprove" | "reset" | "moderator";
  } | null>(null);

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
    moderatorsByAddress,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress,
    setModeratorsByAddress,
    isLoadingPosterStatuses
  } = usePosterStatusMaps({
    open: props.open,
    isOwner: props.isOwner,
    pendingApprovals,
    onChainRequests,
    getReadContract: contractActions.getReadContract,
    chainId: wallet.chainId
  });

  const { addPendingApproval, removePending, approvePending, disapprovePending, resetAllAndBlock, toggleModerator } = useApprovalActions({
    pendingApprovals,
    setPendingApprovals,
    setApprovalsError,
    setPendingInput,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress,
    moderatorsByAddress,
    setModeratorsByAddress,
    runContractTx,
    getReadContract: contractActions.getReadContract,
    getWriteContract: contractActions.getWriteContract,
    feedPosts: feed.posts,
    walletChainId: wallet.chainId
  });

  const pendingRows = useMemo<ApprovalRow[]>(() => {
    return buildApprovalRows({
      addresses: pendingApprovals,
      posterAllowedByAddress,
      posterDisapprovedEverByAddress,
      moderatorsByAddress
    });
  }, [pendingApprovals, posterDisapprovedEverByAddress, posterAllowedByAddress, moderatorsByAddress]);

  const chainRows = useMemo<ApprovalRow[]>(() => {
    return buildApprovalRows({
      addresses: onChainRequests,
      posterAllowedByAddress,
      posterDisapprovedEverByAddress,
      moderatorsByAddress,
      excludeAddress: ownerAddress
    });
  }, [onChainRequests, posterDisapprovedEverByAddress, posterAllowedByAddress, moderatorsByAddress, ownerAddress]);

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

  const handleToggleModerator = useCallback(
    async (addr: string) => {
      if (actionInFlight) return;
      setActionInFlight({ addr, action: "moderator" });
      try {
        await toggleModerator(addr);
      } finally {
        setActionInFlight(null);
      }
    },
    [toggleModerator, actionInFlight]
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
          isLoadingPosterStatuses={isLoadingPosterStatuses}
          actionInFlight={actionInFlight}
          onRemove={handleRemove}
          onApprove={handleApprove}
          onDisapprove={handleDisapprove}
          onReset={handleReset}
          onToggleModerator={handleToggleModerator}
        />

        <ChainRequestsSection
          isOwner={props.isOwner}
          isLoadingOnChainRequests={isLoadingOnChainRequests}
          onChainRequestsLoadError={onChainRequestsLoadError}
          chainRows={chainRows}
          isLoadingPosterStatuses={isLoadingPosterStatuses}
          actionInFlight={actionInFlight}
          onApprove={handleApprove}
          onDisapprove={handleDisapprove}
          onReset={handleReset}
          onToggleModerator={handleToggleModerator}
        />
      </div>
    </Modal>
  );
}
