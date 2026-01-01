import { useCallback, useEffect, useMemo, useState } from "react";

import { Modal } from "@features/app/components/Modal";
import { useContractActions, useContractState } from "@features/contract";
import { useContractTx } from "@features/contract";
import { useFeedState } from "@features/feed";
import { useWalletState } from "@features/wallet";
import { ApprovalListRow } from "./approvals/ApprovalListRow";
import { useApprovalActions } from "./approvals/useApprovalActions";
import { useOnChainApprovalRequests } from "./approvals/useOnChainApprovalRequests";
import { usePosterStatusMaps } from "./approvals/usePosterStatusMaps";
import { useOwnerAddress } from "./useOwnerAddress";

export type ApprovalsModalProps = {
  open: boolean;
  isOwner: boolean;
  onClose: () => void;
  shortAddress: (address: string) => string;
  headerLeading?: React.ReactNode;
};

export function ApprovalsModal(props: ApprovalsModalProps) {
  const contractState = useContractState();
  const contractActions = useContractActions();
  const { runContractTx } = useContractTx();
  const feed = useFeedState();
  const wallet = useWalletState();
  const { ownerAddress } = useOwnerAddress(wallet.walletAddress);

  const [pendingApprovals, setPendingApprovals] = useState<string[]>([]);
  const [pendingInput, setPendingInput] = useState("");
  const [approvalsError, setApprovalsError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setApprovalsError(null);
    setPendingInput("");
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

  const pendingRows = useMemo(() => {
    return pendingApprovals.map((addr) => {
      const key = addr.toLowerCase();
      return {
        addr,
        key,
        isFlagged: !!posterDisapprovedEverByAddress[key],
        isAllowed: !!posterAllowedByAddress[key]
      };
    });
  }, [pendingApprovals, posterDisapprovedEverByAddress, posterAllowedByAddress]);

  const chainRows = useMemo(() => {
    const ownerLower = ownerAddress?.toLowerCase() ?? "";
    return onChainRequests
      .filter((addr) => addr.toLowerCase() !== ownerLower)
      .map((addr) => {
        const key = addr.toLowerCase();
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
    (addr: string) => {
      void approvePending(addr);
    },
    [approvePending]
  );

  const handleDisapprove = useCallback(
    (addr: string) => {
      void disapprovePending(addr);
    },
    [disapprovePending]
  );

  const handleReset = useCallback(
    (addr: string) => {
      void resetAllAndBlock(addr);
    },
    [resetAllAndBlock]
  );

  return (
    <Modal open={props.open} title="Approvals" headerLeading={props.headerLeading} onClose={props.onClose}>
      <div className="composer approvalsModal">
        <div className="muted">Approve wallets that are allowed to mint posts during testing.</div>

        <div className="row">
          <input
            className="input"
            value={pendingInput}
            onChange={(e) => setPendingInput(e.target.value)}
            placeholder="0x... wallet address"
          />
          <button className="secondary" type="button" onClick={() => addPendingApproval(pendingInput)}>
            Add
          </button>
        </div>

        {approvalsError ? <div className="muted">{approvalsError}</div> : null}

        {pendingRows.length === 0 ? null : (
          <div className="list">
            {pendingRows.map((row) => (
              <ApprovalListRow
                key={row.addr}
                addr={row.addr}
                shortAddress={props.shortAddress}
                isFlagged={row.isFlagged}
                isAllowed={row.isAllowed}
                isLoading={isLoadingPosterStatuses}
                showRemove
                onRemove={() => handleRemove(row.addr)}
                onApprove={() => handleApprove(row.addr)}
                onDisapprove={() => handleDisapprove(row.addr)}
                onReset={() => handleReset(row.addr)}
              />
            ))}
          </div>
        )}

        {props.isOwner ? (
          <div className="approvalsSection">
            <div className="muted approvalsSectionTitle">Requests from chain</div>

            {isLoadingOnChainRequests ? (
              <div className="list" aria-busy={true} aria-label="Loading requests" role="status">
                <div className="listRow" aria-hidden="true">
                  <span className="listRowLeft">
                    <span className="value" style={{ display: "inline-flex", alignItems: "center" }}>
                      <span className="skeletonLine" style={{ width: "9rem" }} />
                    </span>
                  </span>
                  <span className="rowActions">
                    <span className="skeletonLine" style={{ width: "16rem", height: "2.25rem", borderRadius: "0.75rem" }} />
                  </span>
                </div>
              </div>
            ) : null}

            {!isLoadingOnChainRequests && onChainRequestsLoadError ? <div className="list muted">Failed to load requests.</div> : null}

            {!isLoadingOnChainRequests && !onChainRequestsLoadError && onChainRequests.length === 0 ? (
              <div className="list muted">No requests found.</div>
            ) : null}

            {chainRows.length ? (
              <div className="list">
                {chainRows.map((row) => (
                  <ApprovalListRow
                    key={row.addr}
                    addr={row.addr}
                    shortAddress={props.shortAddress}
                    isFlagged={row.isFlagged}
                    isAllowed={row.isAllowed}
                    isLoading={isLoadingPosterStatuses}
                    onApprove={() => handleApprove(row.addr)}
                    onDisapprove={() => handleDisapprove(row.addr)}
                    onReset={() => handleReset(row.addr)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
