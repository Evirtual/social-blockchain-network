import { createContext } from "react";
import { createStableContext } from "@shared/lib/createStableContext";
import type { Draft } from "@types";

export type ComposerContextValue = {
  isComposerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;

  ipfsConfigured: boolean;

  draft: Draft;
  isImageLoading: boolean;
  isPosting: boolean;
  postDisabledReason: string | null;
  handleDraftChange: (field: keyof Draft, value: string) => void;
  onComposerImageUrlChange: (value: string) => void;
  onComposerClearImage: () => void;
  onSelectComposerFile: (file: File | null) => Promise<void>;
  mintPost: () => Promise<void>;

  approvalRequired: boolean;
  approvalRequested: boolean;
  isApprovalLoading: boolean;
  requestApproval: () => Promise<void>;
  dismissApproval: () => void;
};

export const ComposerContext = createStableContext("__sbnetComposerContext", () =>
  createContext<ComposerContextValue | null>(null)
);
