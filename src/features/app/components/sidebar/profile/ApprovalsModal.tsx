import { useEffect, useState } from "react";

import { readPendingApprovals } from "@shared/lib/approvalsCache";

import { Modal } from "../../Modal";
import { useContract } from "../../../providers/ContractContext";
import { useContractTx } from "../../../providers/useContractTx";
import { useFeed } from "../../../providers/FeedContext";
import { ApprovalListRow } from "./approvals/ApprovalListRow";
import { useApprovalActions } from "./approvals/useApprovalActions";
import { useOnChainApprovalRequests } from "./approvals/useOnChainApprovalRequests";
import { usePosterStatusMaps } from "./approvals/usePosterStatusMaps";

export type ApprovalsModalProps = {
  open: boolean;
  isOwner: boolean;
  onClose: () => void;
  shortAddress: (address: string) => string;
};

export function ApprovalsModal(props: ApprovalsModalProps) {
  const contract = useContract();
  const { runContractTx } = useContractTx();
  const feed = useFeed();

  const [pendingApprovals, setPendingApprovals] = useState<string[]>(() => readPendingApprovals());
  const [pendingInput, setPendingInput] = useState("");
  const [approvalsError, setApprovalsError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setPendingApprovals(readPendingApprovals());
  }, [props.open]);

  const { onChainRequests, isLoadingOnChainRequests, onChainRequestsLoadError } = useOnChainApprovalRequests({
    open: props.open,
    isOwner: props.isOwner,
    contractAddress: contract.contractAddress,
    getReadContract: contract.getReadContract
  });

  const {
    posterAllowedByAddress,
    posterDisapprovedEverByAddress,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress
  } = usePosterStatusMaps({
    open: props.open,
    isOwner: props.isOwner,
    pendingApprovals,
    onChainRequests,
    getReadContract: contract.getReadContract
  });

  const { addPendingApproval, removePending, approvePending, disapprovePending, resetAllAndBlock } = useApprovalActions({
    pendingApprovals,
    setPendingApprovals,
    setApprovalsError,
    setPendingInput,
    setPosterAllowedByAddress,
    setPosterDisapprovedEverByAddress,
    runContractTx,
    getReadContract: contract.getReadContract,
    getWriteContract: contract.getWriteContract,
    feedPosts: feed.posts
  });

  return (
    <Modal open={props.open} title="Approvals" onClose={props.onClose}>
      <div className="composer">
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

        <div className="list">
          {pendingApprovals.length === 0
            ? null
            : pendingApprovals.map((addr) => (
                <ApprovalListRow
                  key={addr}
                  addr={addr}
                  shortAddress={props.shortAddress}
                  isFlagged={!!posterDisapprovedEverByAddress[addr.toLowerCase()]}
                  isAllowed={!!posterAllowedByAddress[addr.toLowerCase()]}
                  showRemove
                  onRemove={() => removePending(addr)}
                  onApprove={() => void approvePending(addr)}
                  onDisapprove={() => void disapprovePending(addr)}
                  onReset={() => void resetAllAndBlock(addr)}
                />
              ))}
        </div>

        {props.isOwner ? (
          <>
            <div className="muted">Requests from chain</div>

            {isLoadingOnChainRequests ? <div className="muted">Loading…</div> : null}

            {!isLoadingOnChainRequests && onChainRequestsLoadError ? <div className="muted">Failed to load requests.</div> : null}

            {!isLoadingOnChainRequests && !onChainRequestsLoadError && onChainRequests.length === 0 ? (
              <div className="muted">No requests found.</div>
            ) : null}

            {onChainRequests.length ? (
              <div className="list">
                {onChainRequests.map((addr) => (
                  <ApprovalListRow
                    key={addr}
                    addr={addr}
                    shortAddress={props.shortAddress}
                    isFlagged={!!posterDisapprovedEverByAddress[addr.toLowerCase()]}
                    isAllowed={!!posterAllowedByAddress[addr.toLowerCase()]}
                    onApprove={() => void approvePending(addr)}
                    onDisapprove={() => void disapprovePending(addr)}
                    onReset={() => void resetAllAndBlock(addr)}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
