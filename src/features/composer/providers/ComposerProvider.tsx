import { useCallback, useMemo, useState } from "react";
import type { Draft } from "@types";
import { hasPinata } from "../../ipfs/services/ipfs";
import { useComposerMedia } from "../hooks/useComposerMedia";
import { useMintPostFlow } from "../hooks/useMintPostFlow";
import { usePosterApproval } from "../hooks/usePosterApproval";
import { useContractActionsFacade } from "../../contract/hooks/useContractActionsFacade";
import { useFeedActions } from "../../feed/providers/useFeedActions";
import { useFeedState } from "../../feed/providers/useFeedState";
import { isSupportedNetworkChainId } from "../../feed/services/supportedNetworks";
import { useStatusActions } from "../../status/providers/StatusProvider";
import { useTxNotifications } from "../../tx/providers/TxNotificationsProvider";
import { useWalletState } from "../../wallet/providers/useWalletState";
import { MAX_POST_BODY_LENGTH, MAX_POST_TITLE_LENGTH } from "@shared/lib/postLimits";
import { ComposerContext, type ComposerContextValue } from "./composerStateContext";

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const txNotifications = useTxNotifications();
  const { setStatus } = useStatusActions();
  const { walletAddress, chainId } = useWalletState();
  const contract = useContractActionsFacade();
  const feedState = useFeedState();
  const feed = useFeedActions();
  const { runContractTx } = contract;

  const [draft, setDraft] = useState<Draft>({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const ipfsConfigured = hasPinata();
  const isUnsupportedNetwork = Boolean(walletAddress && !isSupportedNetworkChainId(chainId));
  const postDisabledReason = isUnsupportedNetwork
    ? chainId
      ? "Wrong network. Select a supported network before posting."
      : "Select a supported network before posting."
    : null;

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
    feedPosts: feedState.posts,
    runContractTx,
    txNotifications,
    setStatus,
    posterApproval,
    isUnsupportedNetwork,
    unsupportedNetworkMessage: postDisabledReason
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
      postDisabledReason,
      handleDraftChange,
      onComposerImageUrlChange: media.onComposerImageUrlChange,
      onComposerClearImage: media.onComposerClearImage,
      onSelectComposerFile: media.onSelectComposerFile,
      mintPost: mintFlow.mintPost,
      approvalRequired: posterApproval.approvalRequired,
      approvalRequested: posterApproval.approvalRequested,
      isApprovalLoading: posterApproval.isApprovalLoading,
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
      postDisabledReason,
      media.onComposerImageUrlChange,
      media.onComposerClearImage,
      media.onSelectComposerFile,
      mintFlow.isPosting,
      mintFlow.mintPost,
      handleDraftChange,
      posterApproval.approvalRequired,
      posterApproval.approvalRequested,
      posterApproval.isApprovalLoading,
      posterApproval.requestApproval,
      posterApproval.dismissApproval
    ]
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}
