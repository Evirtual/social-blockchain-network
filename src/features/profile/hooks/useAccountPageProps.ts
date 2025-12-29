import { useMemo } from "react";

import type { Draft, Post } from "@types";

const EMPTY_DRAFT: Draft = { title: "", body: "", imageUrl: "", imageDataUrl: "" };

export function useAccountPageProps(args: {
  isOwner: boolean;

  selfKey: string;
  status: string;

  contract: {
    withdrawableTipsWei: bigint;
    contractAddress: string | undefined;
    contractDeployed: boolean | null;
  };

  wallet: {
    chainId: string | null;
    networkName: string | null;
    nativeBalance: string;
    walletAddress: string | null;
  };

  profileCtx: {
    displayName: string;
    profileBio: string;
    profileAvatarUrl: string;
    myPostsCount?: number;

    isEditingProfile: boolean;
    profileDraftName: string;
    profileDraftBio: string;
    profileDraftAvatarUrl: string;
    profileDraftAvatarDataUrl: string;
    isProfileAvatarLoading: boolean;

    setProfileDraftName: (v: string) => void;
    setProfileDraftBio: (v: string) => void;
    setProfileDraftAvatarUrl: (v: string) => void;

    onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
    onClearProfileAvatar: () => void;
    startEditProfile: () => void;
    cancelEditProfile: () => void;

    selfAvatarHue: number;

    authorIdentity: any;
  };

  follow: {
    followerCountByAddress: Record<string, number | undefined>;
    followersByAddress: Record<string, string[] | undefined>;
    followingByAddress: Record<string, string[] | undefined>;
    isLoadingFollowersByAddress: Record<string, boolean | undefined>;
    isLoadingFollowingByAddress: Record<string, boolean | undefined>;
  };

  feed: {
    isFeedLoading: boolean;
  };

  posts: Post[];
  savedPosts: Post[];
  likedPosts: Post[];
  isLoadingSaved: boolean;
  isLoadingLiked: boolean;

  social: {
    editingTokenId: string | null;
    editDraft: Draft | null;
    isEditImageLoading: boolean;
    startEditPost: (p: Post) => void;
    cancelEditPost: () => void;
    onEditClearImage: () => void;
  };

  onDisconnectWallet: () => void;
  onWithdrawTips: () => void | Promise<void>;
  onSaveProfile: () => void;

  onSetEditDraft: (next: Draft) => void;
  onSaveEditedPost: () => Promise<void>;
  onEditSelectFile: (file: File | null) => void;

  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;

  onTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onBurn: (tokenId: string, postChainId?: string | null) => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
}) {
  const {
    isOwner,
    selfKey,
    status,
    contract,
    wallet,
    profileCtx,
    follow,
    feed,
    posts,
    savedPosts,
    likedPosts,
    isLoadingSaved,
    isLoadingLiked,
    social,
    onDisconnectWallet,
    onWithdrawTips,
    onSaveProfile,
    onSetEditDraft,
    onSaveEditedPost,
    onEditSelectFile,
    onAction,
    onTip,
    onBurn,
    onFreezePost,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  } = args;

  return useMemo(() => {
    return {
      isOwner,
      sidebar: {
        walletAddress: wallet.walletAddress,
        displayName: profileCtx.displayName,
        profileBio: profileCtx.profileBio,
        profileAvatarUrl: profileCtx.profileAvatarUrl,
        myPostsCount: profileCtx.myPostsCount,
        isLoadingMyPostsCount: !!feed.isFeedLoading && (profileCtx.myPostsCount ?? 0) === 0,
        followerCount: selfKey ? follow.followerCountByAddress[selfKey] : undefined,
        followers: selfKey ? (follow.followersByAddress[selfKey] ?? null) : null,
        following: selfKey ? (follow.followingByAddress[selfKey] ?? null) : null,
        isLoadingFollowers: selfKey ? !!follow.isLoadingFollowersByAddress[selfKey] : false,
        isLoadingFollowing: selfKey ? !!follow.isLoadingFollowingByAddress[selfKey] : false,
        onDisconnectWallet,
        isEditingProfile: profileCtx.isEditingProfile,
        profileDraftName: profileCtx.profileDraftName,
        profileDraftBio: profileCtx.profileDraftBio,
        profileDraftAvatarUrl: profileCtx.profileDraftAvatarUrl,
        profileDraftAvatarDataUrl: profileCtx.profileDraftAvatarDataUrl,
        isProfileAvatarLoading: profileCtx.isProfileAvatarLoading,
        onProfileDraftNameChange: profileCtx.setProfileDraftName,
        onProfileDraftBioChange: profileCtx.setProfileDraftBio,
        onProfileDraftAvatarUrlChange: profileCtx.setProfileDraftAvatarUrl,
        onSelectProfileAvatarFile: profileCtx.onSelectProfileAvatarFile,
        onClearProfileAvatar: profileCtx.onClearProfileAvatar,
        onStartEditProfile: profileCtx.startEditProfile,
        onCancelEditProfile: profileCtx.cancelEditProfile,
        onSaveProfile,
        selfAvatarHue: profileCtx.selfAvatarHue,
        chainId: wallet.chainId,
        networkName: wallet.networkName,
        nativeBalance: wallet.nativeBalance,
        withdrawableTipsWei: contract.withdrawableTipsWei,
        contractAddress: contract.contractAddress,
        contractDeployed: contract.contractDeployed,
        status,
        onWithdrawTips,
        shortAddress,
        getNativeSymbol
      },
      status,
      isFeedLoading: feed.isFeedLoading,
      posts,
      savedPosts,
      likedPosts,
      isLoadingSaved,
      isLoadingLiked,
      chainId: wallet.chainId,
      walletAddress: wallet.walletAddress,
      authorIdentity: profileCtx.authorIdentity,
      editingTokenId: social.editingTokenId,
      editDraft: social.editDraft ?? EMPTY_DRAFT,
      isEditImageLoading: social.isEditImageLoading,
      onSetEditDraft,
      onStartEditPost: social.startEditPost,
      onCancelEditPost: social.cancelEditPost,
      onSaveEditedPost,
      onEditSelectFile,
      onEditClearImage: social.onEditClearImage,
      onAction,
      onTip,
      onBurn,
      onFreezePost,
      shortAddress,
      stableHueFromSeed,
      getNativeSymbol,
      getExplorerTxUrl
    };
  }, [
    isOwner,
    selfKey,
    status,
    contract.withdrawableTipsWei,
    contract.contractAddress,
    contract.contractDeployed,
    wallet.chainId,
    wallet.networkName,
    wallet.nativeBalance,
    wallet.walletAddress,
    profileCtx.displayName,
    profileCtx.profileBio,
    profileCtx.profileAvatarUrl,
    profileCtx.myPostsCount,
    profileCtx.isEditingProfile,
    profileCtx.profileDraftName,
    profileCtx.profileDraftBio,
    profileCtx.profileDraftAvatarUrl,
    profileCtx.profileDraftAvatarDataUrl,
    profileCtx.isProfileAvatarLoading,
    profileCtx.setProfileDraftName,
    profileCtx.setProfileDraftBio,
    profileCtx.setProfileDraftAvatarUrl,
    profileCtx.onSelectProfileAvatarFile,
    profileCtx.onClearProfileAvatar,
    profileCtx.startEditProfile,
    profileCtx.cancelEditProfile,
    profileCtx.selfAvatarHue,
    profileCtx.authorIdentity,
    follow.followerCountByAddress,
    follow.followersByAddress,
    follow.followingByAddress,
    follow.isLoadingFollowersByAddress,
    follow.isLoadingFollowingByAddress,
    feed.isFeedLoading,
    posts,
    savedPosts,
    likedPosts,
    isLoadingSaved,
    isLoadingLiked,
    social.editingTokenId,
    social.editDraft,
    social.isEditImageLoading,
    social.startEditPost,
    social.cancelEditPost,
    social.onEditClearImage,
    onDisconnectWallet,
    onWithdrawTips,
    onSaveProfile,
    onSetEditDraft,
    onSaveEditedPost,
    onEditSelectFile,
    onAction,
    onTip,
    onBurn,
    onFreezePost,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  ]);
}
