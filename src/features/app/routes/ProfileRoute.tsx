import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useCallback } from "react";
import { AccountPage } from "../../account";
import {
  useContract,
  useContractTx,
  useFeed,
  useFollow,
  useProfile,
  useSocialActions,
  useStatus,
  useWallet
} from "../index";
import { shortAddress, stableHueFromSeed } from "@shared/lib/format";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/chain";
import type { Draft } from "@types";
import {
  ProfilePage,
  useAccountPageProps,
  useLikedPostsByAddress,
  usePosterAdminStatus,
  useProfileAdminActions,
  useProfilePageProps,
  useProfileRouteEffects,
  useSavedPostsByAddress,
  useSelfSavedLikedPosts
} from "../../profile";

export function ProfileRoute() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const feed = useFeed();
  const profileCtx = useProfile();
  const follow = useFollow();
  const social = useSocialActions();
  const { status, setStatus } = useStatus();
  const contract = useContract();
  const { runContractTx } = useContractTx();
  const params = useParams();
  const address = typeof params.address === "string" ? params.address : "";

  const key = address.toLowerCase();
  const isSelf = !!wallet.walletAddress && wallet.walletAddress.toLowerCase() === key;

  const posterAdminStatus = usePosterAdminStatus({ contract, address });

  const onDisconnectWallet = useCallback(() => {
    wallet.disconnectWallet();
    navigate("/", { replace: true });
  }, [wallet, navigate]);

  const onSaveProfile = useCallback(() => {
    void profileCtx.saveProfile();
  }, [profileCtx]);

  const onWithdrawTips = useCallback(async () => {
    await social.withdrawTips();
    try {
      await contract.refreshContractState();
    } catch {
      // ignore
    }
  }, [social, contract]);

  const onSetEditDraft = useCallback((next: Draft) => {
    social.setEditDraft(next);
  }, [social]);

  const onSaveEditedPost = useCallback(() => {
    return social.saveEditedPost();
  }, [social]);

  const onEditSelectFile = useCallback((file: File | null) => {
    void social.onEditSelectFile(file);
  }, [social]);

  const onAction = useCallback(
    (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null, comment?: string) => {
      return social.handleAction(tokenId, action, postChainId, comment);
    },
    [social]
  );

  const onTip = useCallback(
    async (tokenId: string, amountRaw: string, postChainId?: string | null) => {
      const ok = await social.handleTip(tokenId, amountRaw, postChainId);
      if (!ok) return false;
      try {
        await contract.refreshContractState();
      } catch {
        // ignore
      }
      return true;
    },
    [social, contract]
  );

  const onBurn = useCallback(
    (tokenId: string, postChainId?: string | null) => {
      void social.burnPost(tokenId, postChainId);
    },
    [social]
  );

  const onFreeze = useCallback(
    (tokenId: string, postChainId?: string | null) => {
      void social.freezePost(tokenId, postChainId);
    },
    [social]
  );

  if (!address) {
    return <Navigate to="/" replace />;
  }

  const onToggleFollow = useCallback(() => {
    void follow.toggleFollow(address);
  }, [follow, address]);

  const { onAdminSetPosterAllowed, onAdminReset, onAdminSetProfile } = useProfileAdminActions({
    address,
    contract,
    runContractTx,
    feedPosts: feed.posts,
    refreshFeed: feed.refreshFeed,
    walletChainId: wallet.chainId,
    loadProfile: profileCtx.loadProfile,
    setIsPosterAllowed: posterAdminStatus.setIsPosterAllowed,
    setWasPosterDisapprovedEver: posterAdminStatus.setWasPosterDisapprovedEver
  });

  const { likedTokenIdsByAddress, isLoadingLikesByAddress, loadLikesForAddress } = useLikedPostsByAddress({
    walletProvider: wallet.provider,
    chainId: wallet.chainId,
    contractAddress: contract.contractAddress,
    ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contract.getReadContract,
    loadPostsByTokenIds: feed.loadPostsByTokenIds,
    setStatus
  });

  const { savedTokenIdsByAddress, isLoadingSavedByAddress, loadSavedForAddress } = useSavedPostsByAddress({
    walletProvider: wallet.provider,
    chainId: wallet.chainId,
    contractAddress: contract.contractAddress,
    ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contract.getReadContract,
    loadPostsByTokenIds: feed.loadPostsByTokenIds,
    setStatus
  });

  useProfileRouteEffects({
    address,
    isSelf,
    walletAddress: wallet.walletAddress,
    loadProfile: profileCtx.loadProfile,
    loadIsFollowing: follow.loadIsFollowing,
    loadSavedForAddress,
    loadLikesForAddress,
    loadFollowerCountForAddress: follow.loadFollowerCountForAddress,
    loadFollowersForAddress: follow.loadFollowersForAddress,
    loadFollowingForAddress: follow.loadFollowingForAddress
  });

  const profile = profileCtx.profilesByAddress[key];
  const name = profile?.name ?? "";
  const bio = profile?.bio ?? "";
  const avatarUrl = profile?.avatarUrl ?? "";

  const filtered = feed.posts.filter((p) => p.author?.toLowerCase() === key);

  const { savedPosts, likedPosts } = useSelfSavedLikedPosts({
    isSelf,
    walletAddress: wallet.walletAddress,
    feedPosts: feed.posts,
    savedTokenIdsByAddress,
    likedTokenIdsByAddress
  });

  const selfKey = wallet.walletAddress?.toLowerCase() ?? "";

  const accountPageProps = useAccountPageProps({
    isOwner: contract.isOwner,
    selfKey,
    status,
    contract: {
      withdrawableTipsWei: contract.withdrawableTipsWei,
      contractAddress: contract.contractAddress,
      contractDeployed: contract.contractDeployed
    },
    wallet: {
      chainId: wallet.chainId,
      networkName: wallet.networkName,
      nativeBalance: wallet.nativeBalance,
      walletAddress: wallet.walletAddress
    },
    profileCtx: {
      displayName: profileCtx.displayName,
      profileBio: profileCtx.profileBio,
      profileAvatarUrl: profileCtx.profileAvatarUrl,
      myPostsCount: profileCtx.myPostsCount,
      isEditingProfile: profileCtx.isEditingProfile,
      profileDraftName: profileCtx.profileDraftName,
      profileDraftBio: profileCtx.profileDraftBio,
      profileDraftAvatarUrl: profileCtx.profileDraftAvatarUrl,
      profileDraftAvatarDataUrl: profileCtx.profileDraftAvatarDataUrl,
      isProfileAvatarLoading: profileCtx.isProfileAvatarLoading,
      setProfileDraftName: profileCtx.setProfileDraftName,
      setProfileDraftBio: profileCtx.setProfileDraftBio,
      setProfileDraftAvatarUrl: profileCtx.setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile: profileCtx.onSelectProfileAvatarFile,
      onClearProfileAvatar: profileCtx.onClearProfileAvatar,
      startEditProfile: profileCtx.startEditProfile,
      cancelEditProfile: profileCtx.cancelEditProfile,
      selfAvatarHue: profileCtx.selfAvatarHue,
      authorIdentity: profileCtx.authorIdentity
    },
    follow: {
      followerCountByAddress: follow.followerCountByAddress,
      followersByAddress: follow.followersByAddress,
      followingByAddress: follow.followingByAddress,
      isLoadingFollowersByAddress: follow.isLoadingFollowersByAddress,
      isLoadingFollowingByAddress: follow.isLoadingFollowingByAddress
    },
    feed: {
      isFeedLoading: feed.isFeedLoading
    },
    posts: filtered,
    savedPosts,
    likedPosts,
    isLoadingSaved: !!(selfKey && isLoadingSavedByAddress[selfKey]),
    isLoadingLiked: !!(selfKey && isLoadingLikesByAddress[selfKey]),
    social: {
      editingTokenId: social.editingTokenId,
      editDraft: social.editDraft,
      isEditImageLoading: social.isEditImageLoading,
      startEditPost: social.startEditPost,
      cancelEditPost: social.cancelEditPost,
      onEditClearImage: social.onEditClearImage
    },
    onDisconnectWallet,
    onWithdrawTips,
    onSaveProfile,
    onSetEditDraft,
    onSaveEditedPost,
    onEditSelectFile,
    onAction,
    onTip,
    onBurn,
    onFreezePost: onFreeze,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  const profilePageProps = useProfilePageProps({
    isOwner: contract.isOwner,
    isPosterAllowed: posterAdminStatus.isPosterAllowed,
    wasPosterDisapprovedEver: posterAdminStatus.wasPosterDisapprovedEver,
    address,
    key,
    name,
    bio,
    avatarUrl,
    isFollowing: follow.isFollowingByAddress[key],
    posts: filtered,
    chainId: wallet.chainId,
    status,
    isFeedLoading: feed.isFeedLoading,
    walletAddress: wallet.walletAddress,
    authorIdentity: profileCtx.authorIdentity,
    editingTokenId: social.editingTokenId,
    editDraft: social.editDraft,
    isEditImageLoading: social.isEditImageLoading,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile,
    onSetEditDraft,
    onStartEditPost: social.startEditPost,
    onCancelEditPost: social.cancelEditPost,
    onSaveEditedPost,
    onEditSelectFile,
    onEditClearImage: social.onEditClearImage,
    onAction,
    onTip,
    onBurn,
    onFreezePost: onFreeze,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  if (isSelf) {
    return <AccountPage {...accountPageProps} />;
  }

  return <ProfilePage {...profilePageProps} />;
}
