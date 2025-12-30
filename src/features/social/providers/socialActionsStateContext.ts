import { createContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Draft, Post } from "@types";

export type SocialActionsContextValue = {
  isOwner: boolean;

  // Per-post UI state + actions
  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;

  setEditDraft: Dispatch<SetStateAction<Draft>>;

  onEditSelectFile: (file: File | null) => Promise<void>;
  onEditClearImage: () => void;

  startEditPost: (post: Post) => void;
  cancelEditPost: () => void;
  saveEditedPost: () => Promise<void>;

  burnPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
  freezePost: (tokenId: string, postChainId?: string | null) => Promise<void>;

  handleAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  handleTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;

  withdrawTips: () => Promise<void>;
};

export const SocialActionsContext = createContext<SocialActionsContextValue | null>(null);
