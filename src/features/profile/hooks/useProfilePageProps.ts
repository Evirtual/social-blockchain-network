import { useMemo } from "react";

import type { Draft, Post } from "@types";

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

  posts: Post[];
  isFeedLoading: boolean;
  chainId: string | null;
  status: string;
  walletAddress: string | null;
  authorIdentity: any;

  editingTokenId: string | null;
  editDraft: Draft | null;
  isEditImageLoading: boolean;

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

  onSetEditDraft: (next: Draft) => void;
  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => void;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

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
    address,
    key,
    name,
    bio,
    avatarUrl,
    isPosterAllowed,
    wasPosterDisapprovedEver,
    isFollowing,
    posts,
    isFeedLoading,
    chainId,
    status,
    walletAddress,
    authorIdentity,
    editingTokenId,
    editDraft,
    isEditImageLoading,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile,
    onSetEditDraft,
    onStartEditPost,
    onCancelEditPost,
    onSaveEditedPost,
    onEditSelectFile,
    onEditClearImage,
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
      isPosterAllowed,
      wasPosterDisapprovedEver,
      address,
      name,
      bio,
      avatarHue: stableHueFromSeed(key),
      avatarUrl,
      isFollowing,
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
      editingTokenId,
      editDraft: editDraft ?? EMPTY_DRAFT,
      isEditImageLoading,
      onSetEditDraft,
      onStartEditPost,
      onCancelEditPost,
      onSaveEditedPost,
      onEditSelectFile,
      onEditClearImage,
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
    isPosterAllowed,
    wasPosterDisapprovedEver,
    address,
    key,
    name,
    bio,
    avatarUrl,
    isFollowing,
    posts,
    chainId,
    status,
    isFeedLoading,
    walletAddress,
    authorIdentity,
    editingTokenId,
    editDraft,
    isEditImageLoading,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile,
    onSetEditDraft,
    onStartEditPost,
    onCancelEditPost,
    onSaveEditedPost,
    onEditSelectFile,
    onEditClearImage,
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
