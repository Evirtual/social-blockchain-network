import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { ipfsToHttp } from "@features/ipfs";

import { useIsMobile } from "@features/app/hooks/useIsMobile";
import { ApprovalsModal, FollowersModal, FollowingModal, useOwnerAddress } from "@features/profile";
import { useContractActions, useContractState } from "@features/contract";
import { useWalletState } from "@features/wallet";
import { useOnChainApprovalRequests } from "@features/profile/components/sidebar/approvals";
import { ProfileEditModal } from "./profileCard/ProfileEditModal";
import { ProfileHeaderStats } from "./profileCard/ProfileHeaderStats";
import { ProfileSidebarActions } from "./profileCard/ProfileSidebarActions";

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

  const { ownerAddress, isOwner, isLoadingOwner } = useOwnerAddress(props.walletAddress);
  const contractState = useContractState();
  const contractActions = useContractActions();
  const wallet = useWalletState();
  const { onChainRequests, isLoadingOnChainRequests } = useOnChainApprovalRequests({
    open: !!props.walletAddress,
    isOwner,
    chainId: wallet.chainId,
    contractAddress: contractState.contractAddress,
    getReadContract: contractActions.getReadContract
  });

  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false);

  const avatarStyle = avatarDisplayUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(avatarDisplayUrl)})` }
    : { background: `hsl(${props.selfAvatarHue} 75% 55%)` };

  const showHeaderStats = !!props.walletAddress;
  const showHeaderStatsRow = showHeaderStats;
  const ownerLower = ownerAddress?.toLowerCase() ?? "";
  const approvalsCount = onChainRequests.filter((addr) => addr.toLowerCase() !== ownerLower).length;


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
          <ProfileHeaderStats
            showHeaderStats={showHeaderStatsRow}
            showPostsStat={showPostsStat}
            isLoadingMyPostsCount={props.isLoadingMyPostsCount}
            myPostsCount={props.myPostsCount}
            followerCount={props.followerCount}
            followers={followers}
            following={following}
            isLoadingFollowers={props.isLoadingFollowers}
            isLoadingFollowing={props.isLoadingFollowing}
            onOpenFollowers={() => setIsFollowersOpen(true)}
            onOpenFollowing={() => setIsFollowingOpen(true)}
          />
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
              <ProfileSidebarActions
                walletAddress={props.walletAddress}
                isEditingProfile={props.isEditingProfile}
                isOwner={isOwner}
                isLoadingOwner={isLoadingOwner}
                isLoadingOnChainRequests={isLoadingOnChainRequests}
                approvalsCount={approvalsCount}
                onStartEditProfile={props.onStartEditProfile}
                onOpenApprovals={() => setIsApprovalsOpen(true)}
                onDisconnectWallet={props.onDisconnectWallet}
              />
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

        <ProfileEditModal
          open={props.isEditingProfile}
          avatarStyle={avatarStyle}
          profileDraftName={props.profileDraftName}
          profileDraftBio={props.profileDraftBio}
          profileDraftAvatarUrl={props.profileDraftAvatarUrl}
          profileDraftAvatarDataUrl={props.profileDraftAvatarDataUrl}
          isProfileAvatarLoading={props.isProfileAvatarLoading}
          onProfileDraftNameChange={props.onProfileDraftNameChange}
          onProfileDraftBioChange={props.onProfileDraftBioChange}
          onProfileDraftAvatarUrlChange={props.onProfileDraftAvatarUrlChange}
          onSelectProfileAvatarFile={props.onSelectProfileAvatarFile}
          onClearProfileAvatar={props.onClearProfileAvatar}
          onCancelEditProfile={props.onCancelEditProfile}
          onSaveProfile={props.onSaveProfile}
        />

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

