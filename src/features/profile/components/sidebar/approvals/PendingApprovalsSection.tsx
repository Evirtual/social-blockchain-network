import type { ApprovalRow } from "./types";
import { ApprovalListRow } from "./ApprovalListRow";

type Props = {
  pendingInput: string;
  onPendingInputChange: (next: string) => void;
  onAdd: () => void;
  approvalsError: string | null;
  pendingRows: ApprovalRow[];
  shortAddress: (address: string) => string;
  isLoadingPosterStatuses: boolean;
  actionInFlight: { addr: string; action: "approve" | "disapprove" | "reset" } | null;
  onRemove: (addr: string) => void;
  onApprove: (addr: string) => void;
  onDisapprove: (addr: string) => void;
  onReset: (addr: string) => void;
};

export function PendingApprovalsSection(props: Props) {
  return (
    <>
      <div className="row">
        <input
          className="input"
          value={props.pendingInput}
          onChange={(e) => props.onPendingInputChange(e.target.value)}
          placeholder="0x... wallet address"
        />
        <button className="secondary" type="button" onClick={props.onAdd}>
          Add
        </button>
      </div>

      {props.approvalsError ? <div className="muted">{props.approvalsError}</div> : null}

      {props.pendingRows.length === 0 ? null : (
        <div className="list">
          {props.pendingRows.map((row) => (
            <ApprovalListRow
              key={row.addr}
              addr={row.addr}
              shortAddress={props.shortAddress}
              isFlagged={row.isFlagged}
              isAllowed={row.isAllowed}
              isLoading={props.isLoadingPosterStatuses}
              actionInFlight={props.actionInFlight?.addr === row.addr ? props.actionInFlight.action : null}
              showRemove
              onRemove={() => props.onRemove(row.addr)}
              onApprove={() => props.onApprove(row.addr)}
              onDisapprove={() => props.onDisapprove(row.addr)}
              onReset={() => props.onReset(row.addr)}
            />
          ))}
        </div>
      )}
    </>
  );
}
