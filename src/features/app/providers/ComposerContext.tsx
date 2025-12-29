import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { hasPinata } from "../../ipfs";
import type { Draft } from "@types";
import { useComposerMedia, useMintPostFlow, usePosterApproval } from "../../composer";
import { useContract } from "./ContractContext";
import { useFeed } from "./useFeed";
import { useStatus } from "./StatusContext";
import { useTxNotifications } from "./TxNotificationsContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";
import { MAX_POST_BODY_LENGTH, MAX_POST_TITLE_LENGTH } from "@shared/lib/postLimits";

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

const ComposerContext = createContext<ComposerContextValue | null>(null);

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const txNotifications = useTxNotifications();
  const { setStatus } = useStatus();
  const { walletAddress, chainId } = useWallet();
  const contract = useContract();
  const feed = useFeed();
  const { runContractTx } = useContractTx();

  const [draft, setDraft] = useState<Draft>({ title: "", body: "", imageUrl: "", imageDataUrl: "" });

  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const ipfsConfigured = useMemo(() => hasPinata(), []);

  const openComposer = useCallback(() => setIsComposerOpen(true), []);
  const closeComposer = useCallback(() => setIsComposerOpen(false), []);

  const posterApproval = usePosterApproval({ walletAddress, contract, setStatus, runContractTx });

  const handleDraftChange = useCallback((field: keyof Draft, value: string) => {
    let next = value;
    if (field === "title") next = next.slice(0, MAX_POST_TITLE_LENGTH);
    if (field === "body") next = next.slice(0, MAX_POST_BODY_LENGTH);
    setDraft((prev) => ({ ...prev, [field]: next }));
  }, []);

  const media = useComposerMedia({ ipfsConfigured, setStatus, setDraft });
  const mintFlow = useMintPostFlow({
    walletAddress,
    chainId,
    draft,
    setDraft,
    isImageLoading: media.isImageLoading,
    ipfsConfigured,
    uploadedImageBlob: media.uploadedImageBlob,
    uploadedImageFilename: media.uploadedImageFilename,
    resetMedia: media.resetMedia,
    closeComposer,
    contract,
    feed,
    runContractTx,
    txNotifications,
    setStatus,
    posterApproval
  });

  const value = useMemo<ComposerContextValue>(
    () => ({
      isComposerOpen,
      openComposer,
      closeComposer,
      ipfsConfigured,
      draft,
      isImageLoading: media.isImageLoading,
      isPosting: mintFlow.isPosting,
      handleDraftChange,
      onComposerImageUrlChange: media.onComposerImageUrlChange,
      onComposerClearImage: media.onComposerClearImage,
      onSelectComposerFile: media.onSelectComposerFile,
      mintPost: mintFlow.mintPost,
      approvalRequired: posterApproval.approvalRequired,
      approvalRequested: posterApproval.approvalRequested,
      requestApproval: posterApproval.requestApproval,
      dismissApproval: posterApproval.dismissApproval
    }),
    [
      isComposerOpen,
      openComposer,
      closeComposer,
      ipfsConfigured,
      draft,
      media.isImageLoading,
      media.onComposerImageUrlChange,
      media.onComposerClearImage,
      media.onSelectComposerFile,
      mintFlow.isPosting,
      mintFlow.mintPost,
      handleDraftChange,
      posterApproval.approvalRequired,
      posterApproval.approvalRequested,
      posterApproval.requestApproval,
      posterApproval.dismissApproval
    ]
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error("useComposer must be used within <ComposerProvider>");
  return ctx;
}
