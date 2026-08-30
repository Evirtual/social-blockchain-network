import { useMemo } from "react";

import type { Draft, Post } from "@types";
import type { PostActionsController } from "@features/post";
import { stableHueFromSeed } from "@shared/lib/format";

const EMPTY_DRAFT: Draft = { title: "", body: "", imageUrl: "", imageDataUrl: "" };

export function useProfilePageProps(args: {
  isOwner: boolean;

  address: string;
  /** Lowercased account address. Seeds the avatar hue, which stays per-account rather than per-chain. */
  account: string;
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

}) {
  const {
    isOwner,
    address,
    account,
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
    chainId,
    status,
    walletAddress,
    authorIdentity,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile,
    postActions,
  } = args;

  return useMemo(() => {
    return {
      isOwner,
      isPosterAllowed,
      wasPosterDisapprovedEver,
      address,
      name,
      bio,
      avatarHue: stableHueFromSeed(account),
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
      walletAddress,
      authorIdentity,
      postActions: {
        ...postActions,
        editDraft: postActions.editDraft ?? EMPTY_DRAFT
      },
    };
  }, [
    isOwner,
    isPosterAllowed,
    wasPosterDisapprovedEver,
    address,
    account,
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
  ]);
}
