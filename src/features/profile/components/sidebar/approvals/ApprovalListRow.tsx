import { Link } from "react-router-dom";
import { useEffect } from "react";

import { profileKey } from "../../../lib/profileKey";
import { useProfileActions } from "../../../providers/useProfileActions";
import { useProfileState } from "../../../providers/useProfileState";
import { useWalletState } from "@features/wallet";
import { stableHueFromSeed } from "@shared/lib/formatters";
import { getAvatarStyle } from "@shared/lib/avatar";
import { IconCheck, IconPower, IconRepeat, IconTrash, IconX } from "@shared/components/icons";
import { getProfileUrl } from "@shared/lib/profile";
import { shortAddress } from "@shared/lib/format";

export function ApprovalListRow(props: {
  rowNumber?: number;
  addr: string;

  isFlagged: boolean;
  isAllowed: boolean;
  isModerator?: boolean;
  isLoading?: boolean;
  actionInFlight?: "approve" | "disapprove" | "reset" | "moderator" | null;

  showRemove?: boolean;
  onRemove?: () => void;
  onApprove: () => void;
  onDisapprove: () => void;
  onReset: () => void;
  onToggleModerator?: () => void;
}) {
  const profileState = useProfileState();
  const profileActions = useProfileActions();
  const wallet = useWalletState();

  const addrKey = profileKey(wallet.chainId, props.addr);
  const profileName = profileState.profilesByAddress[addrKey]?.name?.trim();
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
  const isTogglingModerator = props.actionInFlight === "moderator";

  return (
    <div key={props.addr} className="listRow" role="listitem">
      <span className="listRowLeft">
        <div className="avatar" style={avatarStyle} aria-hidden="true" />
        <Link className="approvalIdentity" to={getProfileUrl(wallet.chainId, props.addr)} title={props.addr}>
          <span className="approvalIdentityTop">
            <span className="approvalName">{profileName || shortAddress(props.addr)}</span>
          </span>
          <span className="approvalAddress">
            <code>{props.addr}</code>
          </span>
        </Link>
        {props.isFlagged ? <span className="pill">Flagged</span> : null}
        {props.isModerator ? <span className="pill">Mod</span> : null}
      </span>
      <span className="approvalRowActions">
        <span className="approvalRowActionsInline">
          {props.showRemove ? (
            <button
              className="secondary iconButton buttonWithSpinner"
              type="button"
              onClick={props.onRemove}
              disabled={props.isLoading || isBusy}
              aria-label="Remove"
              title="Remove"
            >
              {props.isLoading ? <span className="spinner" aria-hidden="true" /> : null}
              {!props.isLoading ? <IconTrash size={18} aria-hidden="true" /> : null}
            </button>
          ) : null}

          {props.isLoading ? (
            <button className="secondary iconButton" type="button" disabled aria-busy="true" aria-label="Loading">
              {actionSkeleton(1.25)}
            </button>
          ) : null}

          {!props.isLoading && props.onToggleModerator ? (
            <button
              className="secondary iconButton buttonWithSpinner"
              type="button"
              onClick={props.onToggleModerator}
              disabled={isBusy}
              aria-busy={isTogglingModerator}
              aria-label={props.isModerator ? "Unassign moderator" : "Assign moderator"}
              title={props.isModerator ? "Unassign moderator" : "Assign moderator"}
            >
              {isTogglingModerator ? <span className="spinner" aria-hidden="true" /> : null}
              {!isTogglingModerator ? <IconPower size={18} filled={!!props.isModerator} aria-hidden="true" /> : null}
            </button>
          ) : null}

          {!props.isLoading && !props.isAllowed ? (
            <button
              className="primary iconButton buttonWithSpinner"
              type="button"
              onClick={props.onApprove}
              disabled={isBusy}
              aria-busy={isApproving}
              aria-label="Approve"
              title="Approve"
            >
              {isApproving ? <span className="spinner" aria-hidden="true" /> : null}
              {!isApproving ? <IconCheck size={18} aria-hidden="true" /> : null}
            </button>
          ) : null}

          {!props.isLoading && props.isAllowed ? (
            <button
              className="secondary iconButton buttonWithSpinner"
              type="button"
              onClick={props.onDisapprove}
              disabled={isBusy}
              aria-busy={isDisapproving}
              aria-label="Disapprove"
              title="Disapprove"
            >
              {isDisapproving ? <span className="spinner" aria-hidden="true" /> : null}
              {!isDisapproving ? <IconX size={18} aria-hidden="true" /> : null}
            </button>
          ) : null}

          <button
            className="secondary iconButton buttonWithSpinner"
            type="button"
            onClick={props.onReset}
            disabled={props.isLoading || isBusy}
            aria-busy={isResetting}
            aria-label="Reset"
            title="Reset"
          >
            {props.isLoading || isResetting ? <span className="spinner" aria-hidden="true" /> : null}
            {!props.isLoading && !isResetting ? <IconRepeat size={18} aria-hidden="true" /> : null}
          </button>
        </span>
      </span>
    </div>
  );
}
