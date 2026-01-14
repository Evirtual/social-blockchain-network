import type { Draft, Post, PostComment } from "@types";

export type PostActionsController = {
  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  onSetEditDraft: (next: Draft) => void;
  onStartEditPost: (post: Readonly<Post>) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => Promise<void>;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;
  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  replyToComment: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  editComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  deleteComment: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  toggleCommentLike: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  toggleCommentSave: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  tipComment: (
    tokenId: string,
    commentId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<boolean>;
  reportPost: (tokenId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  reportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  onTip: (
    tokenId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<boolean>;
  onBurn: (tokenId: string, postChainId?: string | null) => void | Promise<void>;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void | Promise<void>;
};

export type PostAuthorPresentation = {
  authorLabel: string;
  authorHue: number;
  authorAvatarUrl?: string;
};

export type PostFeedEntry = {
  post: Readonly<Post>;
  author: PostAuthorPresentation;
  isMine: boolean;
  canModerate: boolean;
  panelKey: string;
  compositeKey: string;
};

export type PostPageViewModel = {
  isOwner: boolean;
  tokenId: string;
  postChainId: string | null;
  post: Readonly<Post> | null;
  isLoadingPost: boolean;
  comments: ReadonlyArray<PostComment>;
  isLoadingComments: boolean;
  commentsReadOnly?: boolean;
  disableCommentAuthorProfileLookup?: boolean;
  posts: ReadonlyArray<Post>;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  postActions: PostActionsController;
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};
