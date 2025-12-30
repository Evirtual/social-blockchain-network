import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useContractActions, useContractState } from "@features/contract";
import { useFeedMutations, useFeedQueries } from "@features/feed";
import { useFollow } from "@features/follow";
import { useProfileActions, useProfileState } from "@features/profile";
import { useSocialActions } from "@features/social";
import { usePostActionsController } from "@features/post";
import { useWalletActions, useWalletState } from "@features/wallet";
import { useStatusActions, useStatusState } from "@features/status";
import { useContractTx } from "@features/contract";
import { shortAddress, stableHueFromSeed } from "@shared/lib/format";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/network";
import { AccountPage } from "@features/account";
import { useAccountPageProps } from "../hooks/useAccountPageProps";
import { useLikedPostsByAddress } from "../hooks/useLikedPostsByAddress";
import { useProfileAdminController } from "../hooks/useProfileAdminController";
import { useProfilePageProps } from "../hooks/useProfilePageProps";
import { useProfileRouteEffects } from "../hooks/useProfileRouteEffects";
import { useSavedPostsByAddress } from "../hooks/useSavedPostsByAddress";
import { useSelfSavedLikedPosts } from "../hooks/useSelfSavedLikedPosts";
import { ProfilePage } from "./ProfilePage";

type Props = {
  address: string;
};

export function ProfilePageContainer({ address }: Props) {
  const navigate = useNavigate();
  const walletState = useWalletState();
  const walletActions = useWalletActions();
  const feedState = useFeedQueries();
  const feedActions = useFeedMutations();
  const profileState = useProfileState();
  const profileActions = useProfileActions();
  const follow = useFollow();
  const social = useSocialActions();
  const postActions = usePostActionsController();
  const { status } = useStatusState();
  const { setStatus } = useStatusActions();
  const contractState = useContractState();
  const contractActions = useContractActions();
  const { runContractTx } = useContractTx();

  const key = address.toLowerCase();
  const isSelf = !!walletState.walletAddress && walletState.walletAddress.toLowerCase() === key;

  const admin = useProfileAdminController({
    address,
    contract: {
      isOwner: contractState.isOwner,
      ensureContractDeployedOnCurrentNetwork: contractActions.ensureContractDeployedOnCurrentNetwork,
      getReadContract: contractActions.getReadContract,
      getWriteContract: contractActions.getWriteContract
    },
    runContractTx,
    feedPosts: feedState.posts,
    refreshFeed: feedActions.refreshFeed,
    walletChainId: walletState.chainId,
    loadProfile: () => profileActions.loadProfile(address)
  });

  const onDisconnectWallet = useCallback(() => {
    walletActions.disconnectWallet();
    navigate("/", { replace: true });
  }, [walletActions, navigate]);

  const onSaveProfile = useCallback(() => {
    void profileActions.saveProfile();
  }, [profileActions]);

  const onWithdrawTips = useCallback(async () => {
    await social.withdrawTips();
    try {
      await contractActions.refreshContractState();
    } catch {
      // ignore
    }
  }, [social, contractActions]);

  const onToggleFollow = useCallback(() => {
    void follow.toggleFollow(address);
  }, [follow, address]);


  const { likedTokenIdsByAddress, isLoadingLikesByAddress, loadLikesForAddress } = useLikedPostsByAddress({
    walletProvider: walletState.provider,
    chainId: walletState.chainId,
    contractAddress: contractState.contractAddress,
    ensureContractDeployedOnCurrentNetwork: contractActions.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contractActions.getReadContract,
    loadPostsByTokenIds: feedActions.loadPostsByTokenIds,
    setStatus
  });

  const { savedTokenIdsByAddress, isLoadingSavedByAddress, loadSavedForAddress } = useSavedPostsByAddress({
    walletProvider: walletState.provider,
    chainId: walletState.chainId,
    contractAddress: contractState.contractAddress,
    ensureContractDeployedOnCurrentNetwork: contractActions.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contractActions.getReadContract,
    loadPostsByTokenIds: feedActions.loadPostsByTokenIds,
    setStatus
  });

  useProfileRouteEffects({
    address,
    isSelf,
    walletAddress: walletState.walletAddress,
    loadProfile: profileActions.loadProfile,
    loadIsFollowing: follow.loadIsFollowing,
    loadSavedForAddress,
    loadLikesForAddress,
    loadFollowerCountForAddress: follow.loadFollowerCountForAddress,
    loadFollowersForAddress: follow.loadFollowersForAddress,
    loadFollowingForAddress: follow.loadFollowingForAddress
  });

  const profile = profileState.profilesByAddress[key];
  const name = profile?.name ?? "";
  const bio = profile?.bio ?? "";
  const avatarUrl = profile?.avatarUrl ?? "";

  const filtered = feedState.posts.filter((p) => p.author?.toLowerCase() === key);

  const { savedPosts, likedPosts } = useSelfSavedLikedPosts({
    isSelf,
    walletAddress: walletState.walletAddress,
    feedPosts: feedState.posts,
    savedTokenIdsByAddress,
    likedTokenIdsByAddress
  });

  const selfKey = walletState.walletAddress?.toLowerCase() ?? "";

  const accountPageProps = useAccountPageProps({
    isOwner: contractState.isOwner,
    selfKey,
    status,
    contract: {
      withdrawableTipsWei: contractState.withdrawableTipsWei,
      contractAddress: contractState.contractAddress,
      contractDeployed: contractState.contractDeployed
    },
    wallet: {
      chainId: walletState.chainId,
      networkName: walletState.networkName,
      nativeBalance: walletState.nativeBalance,
      walletAddress: walletState.walletAddress
    },
    profileCtx: {
      displayName: profileState.displayName,
      profileBio: profileState.profileBio,
      profileAvatarUrl: profileState.profileAvatarUrl,
      myPostsCount: profileState.myPostsCount,
      isEditingProfile: profileState.isEditingProfile,
      profileDraftName: profileState.profileDraftName,
      profileDraftBio: profileState.profileDraftBio,
      profileDraftAvatarUrl: profileState.profileDraftAvatarUrl,
      profileDraftAvatarDataUrl: profileState.profileDraftAvatarDataUrl,
      isProfileAvatarLoading: profileState.isProfileAvatarLoading,
      setProfileDraftName: profileActions.setProfileDraftName,
      setProfileDraftBio: profileActions.setProfileDraftBio,
      setProfileDraftAvatarUrl: profileActions.setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile: profileActions.onSelectProfileAvatarFile,
      onClearProfileAvatar: profileActions.onClearProfileAvatar,
      startEditProfile: profileActions.startEditProfile,
      cancelEditProfile: profileActions.cancelEditProfile,
      selfAvatarHue: profileState.selfAvatarHue,
      authorIdentity: profileState.authorIdentity
    },
    follow: {
      followerCountByAddress: follow.followerCountByAddress,
      followersByAddress: follow.followersByAddress,
      followingByAddress: follow.followingByAddress,
      isLoadingFollowersByAddress: follow.isLoadingFollowersByAddress,
      isLoadingFollowingByAddress: follow.isLoadingFollowingByAddress
    },
    feed: {
      isFeedLoading: feedState.isFeedLoading
    },
    posts: filtered,
    savedPosts,
    likedPosts,
    isLoadingSaved: !!(selfKey && isLoadingSavedByAddress[selfKey]),
    isLoadingLiked: !!(selfKey && isLoadingLikesByAddress[selfKey]),
    onDisconnectWallet,
    onWithdrawTips,
    onSaveProfile,
    postActions,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  const profilePageProps = useProfilePageProps({
    isOwner: contractState.isOwner,
    isPosterAllowed: admin.isPosterAllowed,
    wasPosterDisapprovedEver: admin.wasPosterDisapprovedEver,
    address,
    key,
    name,
    bio,
    avatarUrl,
    isFollowing: follow.isFollowingByAddress[key],
    posts: filtered,
    chainId: walletState.chainId,
    status,
    isFeedLoading: feedState.isFeedLoading,
    walletAddress: walletState.walletAddress,
    authorIdentity: profileState.authorIdentity,
    onToggleFollow,
    onAdminSetPosterAllowed: admin.onAdminSetPosterAllowed,
    onAdminReset: admin.onAdminReset,
    onAdminSetProfile: admin.onAdminSetProfile,
    postActions,
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
