import { Navigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { AccountPage } from "../pages/AccountPage";
import { ProfilePage } from "../pages/ProfilePage";
import { useApp } from "../contexts/AppContext";

export function ProfileRoute() {
  const app = useApp();
  const params = useParams();
  const address = typeof params.address === "string" ? params.address : "";

  if (!address) {
    return <Navigate to="/" replace />;
  }

  const key = address.toLowerCase();

  const isSelf = !!app.walletAddress && app.walletAddress.toLowerCase() === key;

  useEffect(() => {
    void app.loadProfile(address);
  }, [app, address]);

  useEffect(() => {
    if (!app.walletAddress) return;
    if (isSelf) return;
    void app.loadIsFollowing(address);
  }, [address, app.walletAddress, app.loadIsFollowing, isSelf]);

  useEffect(() => {
    if (!app.walletAddress) return;
    if (!isSelf) return;
    void app.loadRepostsForAddress(address);
  }, [address, app.loadRepostsForAddress, app.walletAddress, isSelf]);

  useEffect(() => {
    if (!app.walletAddress) return;
    if (!isSelf) return;
    void app.loadFollowerCountForAddress(address);
    void app.loadFollowersForAddress(address);
    void app.loadFollowingForAddress(address);
  }, [address, app.walletAddress, app.loadFollowerCountForAddress, app.loadFollowersForAddress, app.loadFollowingForAddress, isSelf]);

  const profile = app.profilesByAddress[key];
  const name = profile?.name ?? "";
  const bio = profile?.bio ?? "";
  const avatarUrl = profile?.avatarUrl ?? "";

  const filtered = app.posts.filter((p) => p.author?.toLowerCase() === key);

  if (isSelf) {
    const selfKey = app.walletAddress!.toLowerCase();

    const savedTokenIds = app.repostTokenIdsByAddress[selfKey] ?? [];
    const savedPosts = savedTokenIds
      .map((tokenId) => app.posts.find((p) => p.tokenId === tokenId))
      .filter((p): p is NonNullable<typeof p> => !!p);

    return (
      <AccountPage
        sidebar={{
          walletAddress: app.walletAddress,
          displayName: app.displayName,
          profileBio: app.profileBio,
          profileAvatarUrl: app.profileAvatarUrl,
          myPostsCount: app.myPostsCount,
            followerCount: app.followerCountByAddress[selfKey],
            followers: app.followersByAddress[selfKey] ?? null,
            following: app.followingByAddress[selfKey] ?? null,
            isLoadingFollowers: !!app.isLoadingFollowersByAddress[selfKey],
            isLoadingFollowing: !!app.isLoadingFollowingByAddress[selfKey],
          onDisconnectWallet: app.disconnectWallet,
          isEditingProfile: app.isEditingProfile,
          profileDraftName: app.profileDraftName,
          profileDraftBio: app.profileDraftBio,
          profileDraftAvatarUrl: app.profileDraftAvatarUrl,
          profileDraftAvatarDataUrl: app.profileDraftAvatarDataUrl,
          isProfileAvatarLoading: app.isProfileAvatarLoading,
          onProfileDraftNameChange: app.setProfileDraftName,
          onProfileDraftBioChange: app.setProfileDraftBio,
          onProfileDraftAvatarUrlChange: app.setProfileDraftAvatarUrl,
          onSelectProfileAvatarFile: app.onSelectProfileAvatarFile,
          onClearProfileAvatar: app.onClearProfileAvatar,
          onStartEditProfile: app.startEditProfile,
          onCancelEditProfile: app.cancelEditProfile,
          onSaveProfile: app.saveProfile,
          selfAvatarHue: app.selfAvatarHue,
          chainId: app.chainId,
          networkName: app.networkName,
          nativeBalance: app.nativeBalance,
          withdrawableTipsWei: app.withdrawableTipsWei,
          contractAddress: app.contractAddress,
          contractDeployed: app.contractDeployed,
          status: app.status,
          onRefreshWalletPanel: app.refreshWalletPanel,
          onWithdrawTips: app.withdrawTips,
          shortAddress: app.shortAddress,
          getNativeSymbol: app.getNativeSymbol
        }}
        status={app.status}
        isFeedLoading={app.isFeedLoading}
        posts={filtered}
        savedPosts={savedPosts}
          isLoadingSaved={!!app.isLoadingRepostsByAddress[selfKey]}
        chainId={app.chainId}
        walletAddress={app.walletAddress}
        authorIdentity={app.authorIdentity}
        editingTokenId={app.editingTokenId}
        editDraft={app.editDraft}
        isEditImageLoading={app.isEditImageLoading}
        tipDrafts={app.tipDrafts}
        commentDrafts={app.commentDrafts}
        onSetEditDraft={app.setEditDraft}
        onTipDraftChange={app.onTipDraftChange}
        onCommentDraftChange={app.onCommentDraftChange}
        onStartEditPost={app.startEditPost}
        onCancelEditPost={app.cancelEditPost}
        onSaveEditedPost={app.saveEditedPost}
        onEditSelectFile={app.onEditSelectFile}
        onEditClearImage={app.onEditClearImage}
        onAction={app.handleAction}
        onTip={app.handleTip}
        onBurn={app.burnPost}
        onFreezePost={app.freezePost}
        shortAddress={app.shortAddress}
        stableHueFromSeed={app.stableHueFromSeed}
        getNativeSymbol={app.getNativeSymbol}
        getExplorerTxUrl={app.getExplorerTxUrl}
      />
    );
  }

  return (
    <ProfilePage
      address={address}
      name={name}
      bio={bio}
      avatarHue={app.stableHueFromSeed(key)}
      avatarUrl={avatarUrl}
      isFollowing={app.isFollowingByAddress[key]}
      onToggleFollow={() => app.toggleFollow(address)}
      posts={filtered}
      chainId={app.chainId}
      status={app.status}
      isFeedLoading={app.isFeedLoading}
      walletAddress={app.walletAddress}
      authorIdentity={app.authorIdentity}
      editingTokenId={app.editingTokenId}
      editDraft={app.editDraft}
      isEditImageLoading={app.isEditImageLoading}
      tipDrafts={app.tipDrafts}
      commentDrafts={app.commentDrafts}
      onSetEditDraft={app.setEditDraft}
      onTipDraftChange={app.onTipDraftChange}
      onCommentDraftChange={app.onCommentDraftChange}
      onStartEditPost={app.startEditPost}
      onCancelEditPost={app.cancelEditPost}
      onSaveEditedPost={app.saveEditedPost}
      onEditSelectFile={app.onEditSelectFile}
      onEditClearImage={app.onEditClearImage}
      onAction={app.handleAction}
      onTip={app.handleTip}
      onBurn={app.burnPost}
      onFreezePost={app.freezePost}
      shortAddress={app.shortAddress}
      stableHueFromSeed={app.stableHueFromSeed}
      getNativeSymbol={app.getNativeSymbol}
      getExplorerTxUrl={app.getExplorerTxUrl}
    />
  );
}
