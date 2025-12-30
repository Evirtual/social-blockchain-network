import { createContext } from "react";
import type { Draft } from "@types";

export type ComposerContextValue = {
  isComposerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;

  ipfsConfigured: boolean;

  draft: Draft;
  isImageLoading: boolean;
  isPosting: boolean;
  handleDraftChange: (field: keyof Draft, value: string) => void;
  onComposerImageUrlChange: (value: string) => void;
  onComposerClearImage: () => void;
  onSelectComposerFile: (file: File | null) => Promise<void>;
  mintPost: () => Promise<void>;

  approvalRequired: boolean;
  approvalRequested: boolean;
  requestApproval: () => Promise<void>;
  dismissApproval: () => void;
};

export const ComposerContext = createContext<ComposerContextValue | null>(null);
