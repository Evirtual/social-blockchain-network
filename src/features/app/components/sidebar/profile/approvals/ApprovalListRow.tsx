import { Link } from "react-router-dom";

export function ApprovalListRow(props: {
  addr: string;
  shortAddress: (address: string) => string;

  isFlagged: boolean;
  isAllowed: boolean;

  showRemove?: boolean;
  onRemove?: () => void;
  onApprove: () => void;
  onDisapprove: () => void;
  onReset: () => void;
}) {
  return (
    <div key={props.addr} className="listRow" role="listitem">
      <span className="listRowLeft">
        <Link className="value" to={`/profile/${props.addr}`}>
          {props.shortAddress(props.addr)}
        </Link>
        {props.isFlagged ? <span className="pill">Flagged</span> : null}
      </span>
      <span className="rowActions">
        {props.showRemove ? (
          <button className="secondary" type="button" onClick={props.onRemove}>
            Remove
          </button>
        ) : null}

        {props.isAllowed ? null : (
          <button className="primary" type="button" onClick={props.onApprove}>
            Approve
          </button>
        )}

        {props.isAllowed ? (
          <button className="secondary" type="button" onClick={props.onDisapprove}>
            Disapprove
          </button>
        ) : null}

        <button className="secondary" type="button" onClick={props.onReset}>
          Reset
        </button>
      </span>
    </div>
  );
}
