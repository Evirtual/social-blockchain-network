import { useCallback, useMemo, useState } from "react";
import type { Draft } from "@types";
import { hasPinata } from "@features/ipfs";
import { useComposerMedia } from "../hooks/useComposerMedia";
import { useMintPostFlow } from "../hooks/useMintPostFlow";
import { usePosterApproval } from "../hooks/usePosterApproval";
import { useContractActions } from "@features/contract";
import { useFeedActions } from "@features/feed";
import { useStatusActions } from "@features/status";
import { useTxNotifications } from "@features/tx";
import { useWalletState } from "@features/wallet";
import { useContractTx } from "@features/contract";
import { MAX_POST_BODY_LENGTH, MAX_POST_TITLE_LENGTH } from "@shared/lib/postLimits";
import { ComposerContext, type ComposerContextValue } from "./composerStateContext";

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const txNotifications = useTxNotifications();
  const { setStatus } = useStatusActions();
  const { walletAddress, chainId } = useWalletState();
  const contract = useContractActions();
  const feed = useFeedActions();
  const { runContractTx } = useContractTx();

  const [draft, setDraft] = useState<Draft>({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const ipfsConfigured = hasPinata();

  const openComposer = useCallback(() => setIsComposerOpen(true), []);
  const closeComposer = useCallback(() => setIsComposerOpen(false), []);

  const posterApproval = usePosterApproval({ walletAddress, contract, setStatus, runContractTx });

  const handleDraftChange = useCallback((field: keyof Draft, value: string) => {
    let next = value;
    if (field === "title") next = next.slice(0, MAX_POST_TITLE_LENGTH);
    if (field === "body") next = next.slice(0, MAX_POST_BODY_LENGTH);
    setDraft((prev: Draft) => ({ ...prev, [field]: next }));
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
