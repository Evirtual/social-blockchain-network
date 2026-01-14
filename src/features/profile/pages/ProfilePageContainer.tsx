import { useNavigate } from "react-router-dom";
import { useContractActionsFacade, useContractState } from "@features/contract";
import { useFeedMutations, useFeedQueries } from "@features/feed";
import { useFollow } from "@features/follow";
import { useProfileActions, useProfileState } from "@features/profile";
import { useSocialActions } from "@features/social";
import { usePostActionsController } from "@features/post/actions";
import { useWalletActions, useWalletState } from "@features/wallet";
import { useStatusActions, useStatusState } from "@features/status";
import { AccountPage, buildAccountPageViewModel } from "@features/account";
import { useProfileAdminViewModel } from "../admin/viewModel/useProfileAdminViewModel";
import { useProfilePageHandlers } from "../hooks/useProfilePageHandlers";
import { useProfilePageDataViewModel } from "../viewModel";
import { buildProfilePageViewModel } from "../viewModel/buildProfilePageViewModel";
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
  const contractActions = useContractActionsFacade();
  const { runContractTx } = contractActions;

  const admin = useProfileAdminViewModel({
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

  const {
    adminActionInFlight,
    isFollowSubmitting,
    isWithdrawSubmitting,
    onDisconnectWallet,
    onSaveProfile,
    onWithdrawTips,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile
  } = useProfilePageHandlers({
    address,
    navigate,
    setStatus,
    walletActions,
    profileActions,
    social,
    contractActions,
    follow,
    admin
  });


  const {
    key,
    isSelf,
    name,
    bio,
    avatarUrl,
    filtered,
    savedPosts,
    likedPosts,
    selfKey,
    isLoadingSaved,
    isLoadingLiked
  } = useProfilePageDataViewModel({
    address,
    walletState,
    contractState,
    contractActions,
    feedState,
    feedActions,
    profileState,
    profileActions,
    follow,
    setStatus
  });

  const { accountPageProps, profilePageProps } = buildProfilePageViewModel({
    address,
    status,
    contractState: {
      isOwner: contractState.isOwner,
      withdrawableTipsWei: contractState.withdrawableTipsWei,
      withdrawFeeBps: contractState.withdrawFeeBps,
      protocolTreasuryAddress: contractState.protocolTreasuryAddress,
      treasuryWithdrawableTipsWei: contractState.treasuryWithdrawableTipsWei,
      treasuryNativeBalanceWei: contractState.treasuryNativeBalanceWei,
      contractAddress: contractState.contractAddress,
      contractDeployed: contractState.contractDeployed
    },
    walletState: {
      chainId: walletState.chainId,
      networkName: walletState.networkName,
      nativeBalance: walletState.nativeBalance,
      walletAddress: walletState.walletAddress
    },
    profileState: {
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
      isProfileSaving: profileState.isProfileSaving,
      selfAvatarHue: profileState.selfAvatarHue,
      authorIdentity: profileState.authorIdentity
    },
    profileActions: {
      setProfileDraftName: profileActions.setProfileDraftName,
      setProfileDraftBio: profileActions.setProfileDraftBio,
      onSelectProfileAvatarFile: profileActions.onSelectProfileAvatarFile,
      onClearProfileAvatar: profileActions.onClearProfileAvatar,
      startEditProfile: profileActions.startEditProfile,
      cancelEditProfile: profileActions.cancelEditProfile
    },
    follow: {
      followerCountByAddress: follow.followerCountByAddress,
      followersByAddress: follow.followersByAddress,
      followingByAddress: follow.followingByAddress,
      isLoadingFollowersByAddress: follow.isLoadingFollowersByAddress,
      isLoadingFollowingByAddress: follow.isLoadingFollowingByAddress,
      isFollowingByAddress: follow.isFollowingByAddress
    },
    feedState: {
      isFeedLoading: feedState.isFeedLoading,
      isDemoModeEnabled: feedState.isDemoModeEnabled,
      isLiveFeedEnabled: feedState.isLiveFeedEnabled
    },
    admin: {
      isPosterAllowed: admin.isPosterAllowed,
      wasPosterDisapprovedEver: admin.wasPosterDisapprovedEver
    },
    handlers: {
      adminActionInFlight,
      isFollowSubmitting,
      isWithdrawSubmitting,
      onDisconnectWallet,
      onWithdrawTips,
      onSaveProfile,
      onToggleFollow,
      onAdminSetPosterAllowed,
      onAdminReset,
      onAdminSetProfile
    },
    postActions,
    data: {
      key,
      isSelf,
      name,
      bio,
      avatarUrl,
      filtered,
      savedPosts,
      likedPosts,
      selfKey,
      isLoadingSaved,
      isLoadingLiked
    }
  });

  if (isSelf) {
    const accountViewModel = buildAccountPageViewModel(accountPageProps);
    return <AccountPage {...accountViewModel} />;
  }

  return <ProfilePage {...profilePageProps} />;
}
