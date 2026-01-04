import type { ProfilePageViewModel, ProfilePageViewModelInput } from "../types";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/network";
import { useAccountPageProps } from "./useAccountPageProps";
import { useProfilePagePropsViewModel } from "../viewModel/useProfilePagePropsViewModel";

export function useProfilePageViewModel(args: ProfilePageViewModelInput): ProfilePageViewModel {
  const accountPageProps = useAccountPageProps({
    isOwner: args.contractState.isOwner,
    selfKey: args.data.selfKey,
    status: args.status,
    contract: {
      withdrawableTipsWei: args.contractState.withdrawableTipsWei,
      contractAddress: args.contractState.contractAddress,
      contractDeployed: args.contractState.contractDeployed
    },
    wallet: {
      chainId: args.walletState.chainId,
      networkName: args.walletState.networkName,
      nativeBalance: args.walletState.nativeBalance,
      walletAddress: args.walletState.walletAddress
    },
    profileCtx: {
      displayName: args.profileState.displayName,
      profileBio: args.profileState.profileBio,
      profileAvatarUrl: args.profileState.profileAvatarUrl,
      myPostsCount: args.profileState.myPostsCount,
      isEditingProfile: args.profileState.isEditingProfile,
      profileDraftName: args.profileState.profileDraftName,
      profileDraftBio: args.profileState.profileDraftBio,
      profileDraftAvatarUrl: args.profileState.profileDraftAvatarUrl,
      profileDraftAvatarDataUrl: args.profileState.profileDraftAvatarDataUrl,
      isProfileAvatarLoading: args.profileState.isProfileAvatarLoading,
      isProfileSaving: args.profileState.isProfileSaving,
      setProfileDraftName: args.profileActions.setProfileDraftName,
      setProfileDraftBio: args.profileActions.setProfileDraftBio,
      setProfileDraftAvatarUrl: args.profileActions.setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile: args.profileActions.onSelectProfileAvatarFile,
      onClearProfileAvatar: args.profileActions.onClearProfileAvatar,
      startEditProfile: args.profileActions.startEditProfile,
      cancelEditProfile: args.profileActions.cancelEditProfile,
      selfAvatarHue: args.profileState.selfAvatarHue,
      authorIdentity: args.profileState.authorIdentity
    },
    follow: {
      followerCountByAddress: args.follow.followerCountByAddress,
      followersByAddress: args.follow.followersByAddress,
      followingByAddress: args.follow.followingByAddress,
      isLoadingFollowersByAddress: args.follow.isLoadingFollowersByAddress,
      isLoadingFollowingByAddress: args.follow.isLoadingFollowingByAddress
    },
    feed: {
      isFeedLoading: args.feedState.isFeedLoading
    },
    posts: args.data.filtered,
    savedPosts: args.data.savedPosts,
    likedPosts: args.data.likedPosts,
    isLoadingSaved: args.data.isLoadingSaved,
    isLoadingLiked: args.data.isLoadingLiked,
    onDisconnectWallet: args.handlers.onDisconnectWallet,
    onWithdrawTips: args.handlers.onWithdrawTips,
    onSaveProfile: args.handlers.onSaveProfile,
    postActions: args.postActions,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  const profilePageProps = useProfilePagePropsViewModel({
    isOwner: args.contractState.isOwner,
    isPosterAllowed: args.admin.isPosterAllowed,
    wasPosterDisapprovedEver: args.admin.wasPosterDisapprovedEver,
    adminActionInFlight: args.handlers.adminActionInFlight,
    address: args.address,
    key: args.data.key,
    name: args.data.name,
    bio: args.data.bio,
    avatarUrl: args.data.avatarUrl,
    isFollowing: args.follow.isFollowingByAddress[args.data.key],
    isFollowSubmitting: args.handlers.isFollowSubmitting,
    posts: args.data.filtered,
    chainId: args.walletState.chainId,
    status: args.status,
    isFeedLoading: args.feedState.isFeedLoading,
    isDemoModeEnabled: args.feedState.isDemoModeEnabled,
    isLiveFeedEnabled: args.feedState.isLiveFeedEnabled,
    walletAddress: args.walletState.walletAddress,
    authorIdentity: args.profileState.authorIdentity,
    onToggleFollow: args.handlers.onToggleFollow,
    onAdminSetPosterAllowed: args.handlers.onAdminSetPosterAllowed,
    onAdminReset: args.handlers.onAdminReset,
    onAdminSetProfile: args.handlers.onAdminSetProfile,
    postActions: args.postActions,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  return { accountPageProps, profilePageProps, isSelf: args.data.isSelf };
}
