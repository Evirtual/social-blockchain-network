import { Link } from "react-router-dom";
import { useEffect } from "react";

import { useProfileActions, useProfileState } from "@features/profile";
import { stableHueFromSeed } from "@shared/lib/formatters";
import { getAvatarStyle } from "@shared/lib/avatar";

export function ApprovalListRow(props: {
  addr: string;
  shortAddress: (address: string) => string;

  isFlagged: boolean;
  isAllowed: boolean;
  isLoading?: boolean;
  actionInFlight?: "approve" | "disapprove" | "reset" | null;

  showRemove?: boolean;
  onRemove?: () => void;
  onApprove: () => void;
  onDisapprove: () => void;
  onReset: () => void;
}) {
  const profileState = useProfileState();
  const profileActions = useProfileActions();

  const addrKey = props.addr.toLowerCase();
  const avatarUrl = profileState.profilesByAddress[addrKey]?.avatarUrl?.trim();
  const avatarStyle = getAvatarStyle({ avatarUrl, hue: stableHueFromSeed(props.addr) });

  useEffect(() => {
    if (!props.addr) return;
    if (profileState.profilesByAddress[addrKey]) return;
    void profileActions.loadProfile(props.addr);
  }, [addrKey, profileActions, profileState.profilesByAddress, props.addr]);

  const actionSkeleton = (widthRem: number) => (
    <span className="skeletonLine" style={{ width: `${widthRem}rem`, height: "1rem" }} aria-hidden="true" />
  );
  const isBusy = !!props.actionInFlight;
  const isApproving = props.actionInFlight === "approve";
  const isDisapproving = props.actionInFlight === "disapprove";
  const isResetting = props.actionInFlight === "reset";

  return (
    <div key={props.addr} className="listRow" role="listitem">
      <span className="listRowLeft">
        <div className="avatar" style={avatarStyle} aria-hidden="true" />
        <Link className="value" to={`/profile/${props.addr}`}>
          {props.shortAddress(props.addr)}
        </Link>
        {props.isFlagged ? <span className="pill">Flagged</span> : null}
      </span>
      <span className="rowActions">
        {props.showRemove ? (
          <button
            className="secondary buttonWithSpinner"
            type="button"
            onClick={props.onRemove}
            disabled={props.isLoading || isBusy}
          >
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
          <button
            className="primary buttonWithSpinner"
            type="button"
            onClick={props.onApprove}
            disabled={isBusy}
            aria-busy={isApproving}
          >
            {isApproving ? <span className="spinner" aria-hidden="true" /> : null}
            Approve
          </button>
        ) : null}

        {!props.isLoading && props.isAllowed ? (
          <button
            className="secondary buttonWithSpinner"
            type="button"
            onClick={props.onDisapprove}
            disabled={isBusy}
            aria-busy={isDisapproving}
          >
            {isDisapproving ? <span className="spinner" aria-hidden="true" /> : null}
            Disapprove
          </button>
        ) : null}

        <button
          className="secondary buttonWithSpinner"
          type="button"
          onClick={props.onReset}
          disabled={props.isLoading || isBusy}
          aria-busy={isResetting}
        >
          {props.isLoading || isResetting ? <span className="spinner" aria-hidden="true" /> : null}
          Reset
        </button>
      </span>
    </div>
  );
}
