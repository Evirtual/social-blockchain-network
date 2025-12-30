import type { Draft, Post } from "@types";

export type PostActionsController = {
  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  onSetEditDraft: (next: Draft) => void;
  onStartEditPost: (post: Post) => void;
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
  onTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onBurn: (tokenId: string, postChainId?: string | null) => void | Promise<void>;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void | Promise<void>;
};
