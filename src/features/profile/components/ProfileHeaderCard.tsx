import { ipfsToHttp } from "@features/ipfs";

type Props = {
  canAdminEdit: boolean;
  wasPosterDisapprovedEver?: boolean;
  isAllowed: boolean;
  isAdminEditing: boolean;
  onToggleAdminEdit: () => void;
  onAdminSetPosterAllowed: (allowed: boolean) => void;
  onAdminReset: () => void;

  canFollow: boolean;
  isFollowing: boolean | undefined;
  onToggleFollow: () => void;

  name: string;
  addressLabel: string;
  bio: string;
  avatarHue: number;
  avatarUrl?: string;
};

export function ProfileHeaderCard(props: Props) {
  const avatarStyle = props.avatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(props.avatarUrl)})` }
    : { background: `hsl(${props.avatarHue} 75% 55%)` };

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="cardTitle">Profile</div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {props.canAdminEdit ? (
            <>
              {props.wasPosterDisapprovedEver ? <span className="pill">Flagged</span> : null}
              <button className="secondary" type="button" onClick={props.onToggleAdminEdit}>
                {props.isAdminEditing ? "Close" : "Edit Profile"}
              </button>
              {props.isAllowed ? (
                <button className="secondary" type="button" onClick={() => props.onAdminSetPosterAllowed(false)}>
                  Disapprove
                </button>
              ) : (
                <button className="primary" type="button" onClick={() => props.onAdminSetPosterAllowed(true)}>
                  Approve
                </button>
              )}
              <button className="secondary" type="button" onClick={props.onAdminReset}>
                Reset
              </button>
            </>
          ) : null}

          {props.canFollow ? (
            <button
              className="secondary"
              type="button"
              onClick={props.onToggleFollow}
              disabled={typeof props.isFollowing !== "boolean"}
            >
              {props.isFollowing ? "Unfollow" : "Follow"}
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
      </div>

      <div className="profileBio">
        <div className="muted">{props.bio || "No bio yet."}</div>
      </div>
    </div>
  );
}
