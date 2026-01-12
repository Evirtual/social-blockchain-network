import type { ApprovalRow } from "./types";
import { ApprovalListRow } from "./ApprovalListRow";

type Props = {
  isOwner: boolean;
  isLoadingOnChainRequests: boolean;
  onChainRequestsLoadError: boolean;
  chainRows: ApprovalRow[];
  shortAddress: (address: string) => string;
  isLoadingPosterStatuses: boolean;
  actionInFlight: { addr: string; action: "approve" | "disapprove" | "reset" | "moderator" } | null;
  onApprove: (addr: string) => void;
  onDisapprove: (addr: string) => void;
  onReset: (addr: string) => void;
  onToggleModerator: (addr: string) => void;
};

export function ChainRequestsSection(props: Props) {
  if (!props.isOwner) return null;

  return (
    <div className="approvalsSection">
      <div className="muted approvalsSectionTitle">Requests from chain</div>

      {props.isLoadingOnChainRequests ? (
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

      {!props.isLoadingOnChainRequests && props.onChainRequestsLoadError ? (
        <div className="list muted">Failed to load requests.</div>
      ) : null}

      {!props.isLoadingOnChainRequests && !props.onChainRequestsLoadError && props.chainRows.length === 0 ? (
        <div className="list muted">No requests found.</div>
      ) : null}

      {props.chainRows.length ? (
        <div className="list">
          {props.chainRows.map((row) => (
            <ApprovalListRow
              key={row.addr}
              addr={row.addr}
              shortAddress={props.shortAddress}
              isFlagged={row.isFlagged}
              isAllowed={row.isAllowed}
              isModerator={row.isModerator}
              isLoading={props.isLoadingPosterStatuses}
              actionInFlight={props.actionInFlight?.addr === row.addr ? props.actionInFlight.action : null}
              onApprove={() => props.onApprove(row.addr)}
              onDisapprove={() => props.onDisapprove(row.addr)}
              onReset={() => props.onReset(row.addr)}
              onToggleModerator={() => props.onToggleModerator(row.addr)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
