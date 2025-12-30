import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { ipfsToHttp } from "@features/ipfs";

import { Modal } from "../Modal";
import { useIsMobile } from "@features/app/hooks/useIsMobile";
import { ApprovalsModal } from "./profile/ApprovalsModal";
import { FollowersModal } from "./profile/FollowersModal";
import { FollowingModal } from "./profile/FollowingModal";
import { useOwnerAddress } from "./profile/useOwnerAddress";
import { IconCheck, IconEdit, IconPower } from "../icons";

export type ProfileCardProps = {
  walletAddress: string | null;
  displayName: string;
  profileBio: string;
  profileAvatarUrl: string;
  myPostsCount?: number;
  isLoadingMyPostsCount?: boolean;
  followerCount?: number;
  followers?: string[] | null;
  following?: string[] | null;
  isLoadingFollowers?: boolean;
  isLoadingFollowing?: boolean;
  onDisconnectWallet: () => void;
  isEditingProfile: boolean;
  profileDraftName: string;
  profileDraftBio: string;
  profileDraftAvatarUrl: string;
  profileDraftAvatarDataUrl: string;
  isProfileAvatarLoading: boolean;
  onProfileDraftNameChange: (value: string) => void;
  onProfileDraftBioChange: (value: string) => void;
  onProfileDraftAvatarUrlChange: (value: string) => void;
  onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
  onClearProfileAvatar: () => void;
  onStartEditProfile: () => void;
  onCancelEditProfile: () => void;
  onSaveProfile: () => void | Promise<void>;
  selfAvatarHue: number;
  shortAddress: (address: string) => string;
};

export function ProfileCard(props: ProfileCardProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => !isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const profileLink = props.walletAddress ? `/profile/${props.walletAddress}` : null;
  const avatarDisplayUrl = props.profileAvatarUrl;

  const followers = props.followers ?? [];
  const following = props.following ?? [];

  const showPostsStat = props.isLoadingMyPostsCount || typeof props.myPostsCount === "number";

  const [isFollowersOpen, setIsFollowersOpen] = useState(false);
  const [isFollowingOpen, setIsFollowingOpen] = useState(false);

  const { isOwner } = useOwnerAddress(props.walletAddress);

  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);

  const avatarStyle = avatarDisplayUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(avatarDisplayUrl)})` }
    : { background: `hsl(${props.selfAvatarHue} 75% 55%)` };

  const showHeaderStats = !!props.walletAddress;
  const showHeaderStatsRow = showHeaderStats;

  const pillCountSkeleton = (widthRem: number) => (
    <span className="skeletonLine" style={{ width: `${widthRem}rem`, height: "0.85rem" }} aria-hidden="true" />
  );

  return (
    <details
      className="card cardDropdown profileDropdown"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cardDropdownSummary">
        <span className="cardTitle">Profile</span>
        <span className="cardDropdownMeta">{props.walletAddress ? props.shortAddress(props.walletAddress) : "Disconnected"}</span>
      </summary>

      <div className="cardDropdownBody">
        <div className="cardHeader">
          <div className="cardTitle">Profile</div>
          {showHeaderStatsRow ? (
            <div className="cardHeaderStats" aria-label="Profile stats">
              {props.isLoadingMyPostsCount ? (
                <span className="cardHeaderStat buttonWithSpinner" aria-label="Loading post count" aria-busy="true">
                  {pillCountSkeleton(1.9)} posts
                </span>
              ) : typeof props.myPostsCount === "number" ? (
                <span className="cardHeaderStat">{props.myPostsCount} posts</span>
              ) : null}
              {showPostsStat ? (
                <span className="cardHeaderStatSep" aria-hidden="true">
                  ·
                </span>
              ) : null}
              <button type="button" className="cardHeaderStatLink buttonWithSpinner" onClick={() => setIsFollowersOpen(true)}>
                {props.isLoadingFollowers ? (
                  <>
                    {pillCountSkeleton(2.1)} followers
                  </>
                ) : (
                  `${typeof props.followerCount === "number" ? props.followerCount : followers.length} followers`
                )}
              </button>
              <span className="cardHeaderStatSep" aria-hidden="true">
                ·
              </span>
              <button type="button" className="cardHeaderStatLink buttonWithSpinner" onClick={() => setIsFollowingOpen(true)}>
                {props.isLoadingFollowing ? (
                  <>
                    {pillCountSkeleton(2.1)} following
                  </>
                ) : (
                  `${following.length} following`
                )}
              </button>
            </div>
          ) : null}
        </div>

        <div className="profileHeader">
          <div className="avatar" style={avatarStyle} />
          <div className="profileMain">
            <div className="profileName">{profileLink ? <Link to={profileLink}>{props.displayName}</Link> : props.displayName}</div>
            <div className="profileMeta">
              {props.walletAddress ? (
                <Link to={profileLink!}>{props.shortAddress(props.walletAddress)}</Link>
              ) : (
                "Connect wallet to edit profile"
              )}
            </div>
          </div>

          {props.walletAddress ? (
            <div className="profileActions">
              {!props.isEditingProfile ? (
                <button className="cardActionLink" type="button" onClick={props.onStartEditProfile}>
                  <IconEdit size={16} />
                  Edit
                </button>
              ) : null}
              {props.walletAddress && !props.isEditingProfile && isOwner ? (
                <button
                  className="cardActionLink cardActionApprove"
                  type="button"
                  onClick={() => setIsApprovalsOpen(true)}
                  aria-label="Approvals"
                >
                  <IconCheck size={16} />
                  Approve
                </button>
              ) : null}
              {props.walletAddress && !props.isEditingProfile ? (
                <button
                  className="ghost iconButton profileDisconnectButton"
                  type="button"
                  onClick={props.onDisconnectWallet}
                  aria-label="Disconnect"
                  title="Disconnect"
                >
                  <IconPower size={20} strokeWidth={2.2} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <ApprovalsModal
          open={isApprovalsOpen}
          isOwner={isOwner}
          onClose={() => setIsApprovalsOpen(false)}
          shortAddress={props.shortAddress}
          headerLeading={<div className="avatar small" style={avatarStyle} />}
        />

        <Modal
          open={props.isEditingProfile}
          title="Edit profile"
          headerLeading={<div className="avatar small" style={avatarStyle} />}
          onClose={props.onCancelEditProfile}
        >
          <div className="composer">
            <input
              className="input"
              value={props.profileDraftName}
              onChange={(e) => props.onProfileDraftNameChange(e.target.value)}
              placeholder="Display name"
            />
            <textarea
              className="textarea"
              rows={3}
              value={props.profileDraftBio}
              onChange={(e) => props.onProfileDraftBioChange(e.target.value)}
              placeholder="Bio"
            />

            <input
              className="input"
              value={props.profileDraftAvatarUrl}
              onChange={(e) => props.onProfileDraftAvatarUrlChange(e.target.value)}
              placeholder="Avatar image URL (or upload below)"
            />

            <div className="row fileRow">
              <input
                className="file-input"
                type="file"
                accept="image/*"
                onChange={(event) => props.onSelectProfileAvatarFile(event.target.files?.[0] ?? null)}
              />
              <button type="button" className="secondary" onClick={props.onClearProfileAvatar}>
                Clear
              </button>
            </div>

            {props.profileDraftAvatarDataUrl.startsWith("data:image/") && (
              <img className="image-preview" src={props.profileDraftAvatarDataUrl} alt="Avatar preview" />
            )}

            <div className="rowActions">
              <button className="secondary" type="button" onClick={props.onCancelEditProfile}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={props.onSaveProfile} disabled={props.isProfileAvatarLoading}>
                Save
              </button>
            </div>
          </div>
        </Modal>

        <FollowersModal
          open={isFollowersOpen}
          followers={followers}
          isLoadingFollowers={props.isLoadingFollowers}
          onClose={() => setIsFollowersOpen(false)}
          shortAddress={props.shortAddress}
          headerLeading={<div className="avatar small" style={avatarStyle} />}
        />

        <FollowingModal
          open={isFollowingOpen}
          following={following}
          isLoadingFollowing={props.isLoadingFollowing}
          onClose={() => setIsFollowingOpen(false)}
          shortAddress={props.shortAddress}
          headerLeading={<div className="avatar small" style={avatarStyle} />}
        />

        {props.walletAddress && (
          <div className="profileBio">
            <div className="muted">{props.profileBio || "Add a short bio to personalize your profile."}</div>
          </div>
        )}
      </div>
    </details>
  );
}
