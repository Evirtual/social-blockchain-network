import { useRef } from "react";
import { IconDotsVertical } from "@shared/components/icons";
import { useIsMobile } from "@features/app/hooks/useIsMobile";
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
  const isMobile = useIsMobile();
  const adminMenuRef = useRef<HTMLDetailsElement | null>(null);
  const closeAdminMenu = () => {
    if (adminMenuRef.current) {
      adminMenuRef.current.open = false;
    }
  };

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

  const renderAdminButtons = (options?: { closeMenu?: () => void; isMenu?: boolean }) => {
    const wrapAction = (callback: () => void) => () => {
      options?.closeMenu?.();
      callback();
    };

    const adminButtonClass = (baseClass: string) => (options?.isMenu ? `${baseClass} profileAdminOverflowButton` : baseClass);

    return (
      <>
        <button
          className={adminButtonClass("secondary")}
          type="button"
          onClick={wrapAction(props.onToggleAdminEdit)}
        >
          {props.isAdminEditing ? "Close" : "Edit Profile"}
        </button>

        {isAdminLoading ? (
          <>
            <button className={adminButtonClass("secondary buttonWithSpinner")} type="button" disabled aria-busy="true">
              {actionSkeleton(6)}
            </button>
            <button className={adminButtonClass("secondary buttonWithSpinner")} type="button" disabled aria-busy="true">
              {actionSkeleton(4)}
            </button>
          </>
        ) : (
          <>
            {isAllowed ? (
              <button
                className={adminButtonClass("secondary buttonWithSpinner")}
                type="button"
                onClick={wrapAction(() => props.onAdminSetPosterAllowed(false))}
                disabled={isAdminSubmitting}
                aria-busy={isDisapproveBusy}
              >
                {isDisapproveBusy ? <span className="spinner" aria-hidden="true" /> : null}
                Disapprove
              </button>
            ) : (
              <button
                className={adminButtonClass("primary buttonWithSpinner")}
                type="button"
                onClick={wrapAction(() => props.onAdminSetPosterAllowed(true))}
                disabled={isAdminSubmitting}
                aria-busy={isApproveBusy}
              >
                {isApproveBusy ? <span className="spinner" aria-hidden="true" /> : null}
                Approve
              </button>
            )}

            <button
              className={adminButtonClass("secondary buttonWithSpinner")}
              type="button"
              onClick={wrapAction(props.onAdminReset)}
              disabled={isAdminSubmitting}
              aria-busy={isResetBusy}
            >
              {isResetBusy ? <span className="spinner" aria-hidden="true" /> : null}
              Reset
            </button>
          </>
        )}
      </>
    );
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="cardTitle">Profile</div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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

          {props.canAdminEdit ? (
            <>
              {props.wasPosterDisapprovedEver ? <span className="pill">Flagged</span> : null}
              {isMobile ? (
                <details className="profileAdminOverflow" ref={adminMenuRef}>
                  <summary className="ghost iconButton profileAdminOverflowToggle" aria-label="Admin actions" title="Admin actions">
                    <IconDotsVertical size={18} />
                  </summary>
                  <div className="profileAdminOverflowMenu">
                    <div className="profileAdminOverflowMenuInner">
                      {renderAdminButtons({ closeMenu: closeAdminMenu, isMenu: true })}
                    </div>
                  </div>
                </details>
              ) : (
                <div className="profileAdminOverflowInline">{renderAdminButtons()}</div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="profileHeader">
        <div className="avatar" style={avatarStyle} />
        <div className="profileMain">
          <div className="profileName">{props.name || props.addressLabel}</div>
          <div className="profileMeta">{props.addressLabel}</div>
        </div>
      </div>

      <div className="profileBio">
        <div className="muted">{props.bio || "No bio yet."}</div>
      </div>
    </div>
  );
}
