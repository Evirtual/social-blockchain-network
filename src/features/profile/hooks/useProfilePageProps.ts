import { useMemo } from "react";

import type { Draft, Post } from "@types";
import type { PostActionsController } from "@features/post";

const EMPTY_DRAFT: Draft = { title: "", body: "", imageUrl: "", imageDataUrl: "" };

export function useProfilePageProps(args: {
  isOwner: boolean;

  address: string;
  key: string;
  name: string;
  bio: string;
  avatarUrl: string;

  isPosterAllowed: boolean | undefined;
  wasPosterDisapprovedEver: boolean | undefined;
  isFollowing: boolean | undefined;
  isFollowSubmitting?: boolean;
  adminActionInFlight?: "approve" | "disapprove" | "reset" | "save" | null;

  posts: Post[];
  isFeedLoading: boolean;
  isDemoModeEnabled: boolean;
  isLiveFeedEnabled: boolean;
  chainId: string | null;
  status: string;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  onToggleFollow: () => void;
  onAdminSetPosterAllowed: (allowed: boolean) => void | Promise<void>;
  onAdminReset: () => void | Promise<void>;
  onAdminSetProfile: (next: {
    name: string;
    bio: string;
    avatarUrl: string;
    avatarFile?: File | null;
    avatarFilename?: string;
    avatarDataUrl?: string;
  }) => void | Promise<void>;

  postActions: PostActionsController;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
}) {
  const {
    isOwner,
    address,
    key,
    name,
    bio,
    avatarUrl,
    isPosterAllowed,
    wasPosterDisapprovedEver,
    isFollowing,
    isFollowSubmitting,
    adminActionInFlight,
    posts,
    isFeedLoading,
    isDemoModeEnabled,
    isLiveFeedEnabled,
    chainId,
    status,
    walletAddress,
    authorIdentity,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile,
    postActions,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  } = args;

  return useMemo(() => {
    return {
      isOwner,
      isPosterAllowed,
      wasPosterDisapprovedEver,
      address,
      name,
      bio,
      avatarHue: stableHueFromSeed(key),
      avatarUrl,
      isFollowing,
      isFollowSubmitting,
      adminActionInFlight,
      onToggleFollow,
      onAdminSetPosterAllowed,
      onAdminReset,
      onAdminSetProfile,
      posts,
      chainId,
      status,
      isFeedLoading,
      isDemoModeEnabled,
      isLiveFeedEnabled,
      walletAddress,
      authorIdentity,
      postActions: {
        ...postActions,
        editDraft: postActions.editDraft ?? EMPTY_DRAFT
      },
      shortAddress,
      stableHueFromSeed,
      getNativeSymbol,
      getExplorerTxUrl
    };
  }, [
    isOwner,
    isPosterAllowed,
    wasPosterDisapprovedEver,
    address,
    key,
    name,
    bio,
    avatarUrl,
    isFollowing,
    isFollowSubmitting,
    adminActionInFlight,
    posts,
    chainId,
    status,
    isFeedLoading,
    isDemoModeEnabled,
    isLiveFeedEnabled,
    walletAddress,
    authorIdentity,
    postActions.editDraft,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile,
    postActions.editingTokenId,
    postActions.editDraft,
    postActions.isEditImageLoading,
    postActions.onSetEditDraft,
    postActions.onStartEditPost,
    postActions.onCancelEditPost,
    postActions.onSaveEditedPost,
    postActions.onEditSelectFile,
    postActions.onEditClearImage,
    postActions.onAction,
    postActions.onTip,
    postActions.onBurn,
    postActions.onFreezePost,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  ]);
}
