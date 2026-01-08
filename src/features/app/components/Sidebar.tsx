import { ProfileCard, type ProfileCardProps } from "./sidebar/ProfileCard";
import { WalletCard, type WalletCardProps } from "./sidebar/WalletCard";

type Props = ProfileCardProps & WalletCardProps;

export { ProfileCard, WalletCard };
export type { ProfileCardProps, WalletCardProps };

export function Sidebar({
  walletAddress,
  displayName,
  profileBio,
  profileAvatarUrl,
  myPostsCount,
  isLoadingMyPostsCount,
  followerCount,
  followers,
  following,
  isLoadingFollowers,
  isLoadingFollowing,
  onDisconnectWallet,
  isEditingProfile,
  profileDraftName,
  profileDraftBio,
  profileDraftAvatarUrl,
  profileDraftAvatarDataUrl,
  isProfileAvatarLoading,
  isProfileSaving,
  onProfileDraftNameChange,
  onProfileDraftBioChange,
  onProfileDraftAvatarUrlChange,
  onSelectProfileAvatarFile,
  onClearProfileAvatar,
  onStartEditProfile,
  onCancelEditProfile,
  onSaveProfile,
  selfAvatarHue,
  chainId,
  networkName,
  nativeBalance,
  withdrawableTipsWei,
  contractAddress,
  contractDeployed,
  status,
  onWithdrawTips,
  isWithdrawSubmitting,
  shortAddress,
  getNativeSymbol
}: Props) {
  return (
    <aside className="sidebar">
      <ProfileCard
        walletAddress={walletAddress}
        displayName={displayName}
        profileBio={profileBio}
        profileAvatarUrl={profileAvatarUrl}
        myPostsCount={myPostsCount}
        isLoadingMyPostsCount={isLoadingMyPostsCount}
        followerCount={followerCount}
        followers={followers}
        following={following}
        isLoadingFollowers={isLoadingFollowers}
        isLoadingFollowing={isLoadingFollowing}
        onDisconnectWallet={onDisconnectWallet}
        isEditingProfile={isEditingProfile}
        profileDraftName={profileDraftName}
        profileDraftBio={profileDraftBio}
        profileDraftAvatarUrl={profileDraftAvatarUrl}
        profileDraftAvatarDataUrl={profileDraftAvatarDataUrl}
        isProfileAvatarLoading={isProfileAvatarLoading}
        isProfileSaving={isProfileSaving}
        onProfileDraftNameChange={onProfileDraftNameChange}
        onProfileDraftBioChange={onProfileDraftBioChange}
        onProfileDraftAvatarUrlChange={onProfileDraftAvatarUrlChange}
        onSelectProfileAvatarFile={onSelectProfileAvatarFile}
        onClearProfileAvatar={onClearProfileAvatar}
        onStartEditProfile={onStartEditProfile}
        onCancelEditProfile={onCancelEditProfile}
        onSaveProfile={onSaveProfile}
        selfAvatarHue={selfAvatarHue}
        shortAddress={shortAddress}
      />

      <WalletCard
        walletAddress={walletAddress}
        chainId={chainId}
        networkName={networkName}
        nativeBalance={nativeBalance}
        withdrawableTipsWei={withdrawableTipsWei}
        contractAddress={contractAddress}
        contractDeployed={contractDeployed}
        status={status}
        onWithdrawTips={onWithdrawTips}
        isWithdrawSubmitting={isWithdrawSubmitting}
        shortAddress={shortAddress}
        getNativeSymbol={getNativeSymbol}
      />
    </aside>
  );
}
