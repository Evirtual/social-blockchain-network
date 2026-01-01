import { Link } from "react-router-dom";

export function ApprovalListRow(props: {
  addr: string;
  shortAddress: (address: string) => string;

  isFlagged: boolean;
  isAllowed: boolean;
  isLoading?: boolean;

  showRemove?: boolean;
  onRemove?: () => void;
  onApprove: () => void;
  onDisapprove: () => void;
  onReset: () => void;
}) {
  const actionSkeleton = (widthRem: number) => (
    <span className="skeletonLine" style={{ width: `${widthRem}rem`, height: "1rem" }} aria-hidden="true" />
  );

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
          <button className="secondary buttonWithSpinner" type="button" onClick={props.onRemove} disabled={props.isLoading}>
            {props.isLoading ? <span className="spinner" aria-hidden="true" /> : null}
            Remove
          </button>
        ) : null}

        {props.isLoading ? (
          <button className="secondary buttonWithSpinner" type="button" disabled aria-busy="true">
            {actionSkeleton(5)}
          </button>
        ) : null}

        {!props.isLoading && !props.isAllowed ? (
          <button className="primary" type="button" onClick={props.onApprove}>
            Approve
          </button>
        ) : null}

        {!props.isLoading && props.isAllowed ? (
          <button className="secondary" type="button" onClick={props.onDisapprove}>
            Disapprove
          </button>
        ) : null}

        <button className="secondary buttonWithSpinner" type="button" onClick={props.onReset} disabled={props.isLoading}>
          {props.isLoading ? <span className="spinner" aria-hidden="true" /> : null}
          Reset
        </button>
      </span>
    </div>
  );
}
