import { IconCheck, IconEdit, IconRepeat, IconX } from "@shared/components/icons";
import { buildProfileHeaderCardState } from "@features/profile/viewModel";

type Props = {
  canAdminEdit: boolean;
  wasPosterDisapprovedEver?: boolean;
  isPosterAllowed?: boolean;
  isAdminEditing: boolean;
  onToggleAdminEdit: () => void;
  onAdminSetPosterAllowed: (allowed: boolean) => void;
  onAdminReset: () => void;
  adminActionInFlight?: "approve" | "disapprove" | "reset" | "save" | null;

  canFollow: boolean;
  isFollowDisabled?: boolean;
  isFollowing: boolean | undefined;
  isFollowSubmitting?: boolean;
  onToggleFollow: () => void;

  name: string;
  addressLabel: string;
  bio: string;
  avatarHue: number;
  avatarUrl?: string;
};

export function ProfileHeaderCard(props: Props) {
  const {
    isAllowed,
    isAdminLoading,
    isAdminSubmitting,
    isApproveBusy,
    isDisapproveBusy,
    isResetBusy,
    isFollowLoading,
    isFollowSubmitting,
    isFollowBusy,
    avatarStyle
  } = buildProfileHeaderCardState({
    canAdminEdit: props.canAdminEdit,
    wasPosterDisapprovedEver: props.wasPosterDisapprovedEver,
    isPosterAllowed: props.isPosterAllowed,
    adminActionInFlight: props.adminActionInFlight,
    canFollow: props.canFollow,
    isFollowing: props.isFollowing,
    isFollowSubmitting: props.isFollowSubmitting,
    avatarHue: props.avatarHue,
    avatarUrl: props.avatarUrl
  });

  const actionSkeleton = (widthRem: number) => (
    <span className="skeletonLine" style={{ width: `${widthRem}rem`, height: "1rem" }} aria-hidden="true" />
  );

  const renderAdminButtons = () => {
    return (
      <>
        <button
          className="secondary iconButton"
          type="button"
          onClick={props.onToggleAdminEdit}
          aria-label={props.isAdminEditing ? "Close edit" : "Edit profile"}
          title={props.isAdminEditing ? "Close edit" : "Edit profile"}
        >
          {props.isAdminEditing ? <IconX size={18} aria-hidden="true" /> : <IconEdit size={18} aria-hidden="true" />}
        </button>

        {isAdminLoading ? (
          <button className="secondary iconButton" type="button" disabled aria-busy="true" aria-label="Loading" title="Loading">
            {actionSkeleton(1.25)}
          </button>
        ) : !isAllowed ? (
          <button
            className="primary iconButton buttonWithSpinner"
            type="button"
            onClick={() => props.onAdminSetPosterAllowed(true)}
            disabled={isAdminSubmitting}
            aria-busy={isApproveBusy}
            aria-label="Approve"
            title="Approve"
          >
            {isApproveBusy ? <span className="spinner" aria-hidden="true" /> : null}
            {!isApproveBusy ? <IconCheck size={18} aria-hidden="true" /> : null}
          </button>
        ) : (
          <button
            className="secondary iconButton buttonWithSpinner"
            type="button"
            onClick={() => props.onAdminSetPosterAllowed(false)}
            disabled={isAdminSubmitting}
            aria-busy={isDisapproveBusy}
            aria-label="Disapprove"
            title="Disapprove"
          >
            {isDisapproveBusy ? <span className="spinner" aria-hidden="true" /> : null}
            {!isDisapproveBusy ? <IconX size={18} aria-hidden="true" /> : null}
          </button>
        )}

        <button
          className="secondary iconButton buttonWithSpinner"
          type="button"
          onClick={props.onAdminReset}
          disabled={isAdminSubmitting}
          aria-busy={isResetBusy}
          aria-label="Reset"
          title="Reset"
        >
          {isResetBusy ? <span className="spinner" aria-hidden="true" /> : null}
          {!isResetBusy ? <IconRepeat size={18} aria-hidden="true" /> : null}
        </button>
      </>
    );
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="cardTitle profileCardTitle">
          <span>Profile</span>
          {props.canAdminEdit && props.wasPosterDisapprovedEver ? <span className="pill">Flagged</span> : null}
        </div>
        <div className="profileHeaderFollow">
          {props.canFollow ? (
            <button
              className="secondary buttonWithSpinner"
              type="button"
              onClick={props.onToggleFollow}
              disabled={isFollowBusy || !!props.isFollowDisabled}
              aria-busy={isFollowSubmitting}
            >
              {isFollowLoading ? (
                actionSkeleton(5)
              ) : (
                <>
                  {isFollowSubmitting ? <span className="spinner" aria-hidden="true" /> : null}
                  {props.isFollowing ? "Unfollow" : "Follow"}
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      <div className="profileHeader">
        <div className="avatar" style={avatarStyle} />
        <div className="profileMain">
          <div className="profileName">{props.name || props.addressLabel}</div>
          <div className="profileMeta">{props.addressLabel}</div>
        </div>

        {props.canAdminEdit ? (
          <div className="profileActions">
            {renderAdminButtons()}
          </div>
        ) : null}
      </div>

      <div className="profileBio">
        <div className="muted">{props.bio || "No bio yet."}</div>
      </div>
    </div>
  );
}
