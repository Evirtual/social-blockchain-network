import { useCallback, useMemo, useRef, useState } from "react";
import type { Draft, Post } from "@types";
import { createMetadataUri } from "@features/metadata";
import { getErrorMessage } from "@shared/lib/errors";
import { buildIpfsTokenUri, ipfsToHttp } from "@features/ipfs";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { makeLocalNoticeId, normalizeChainIdToString } from "../services/utils";
import { parseMintPostReceipt } from "../services/mintPost/parseMintPostReceipt";
import { waitForMetadataReady } from "../services/mintPost/waitForMetadataReady";
import { waitForUrlReachable } from "../services/mintPost/waitForUrlReachable";

type TxNotificationsLike = {
  notifyPending: (p: { hash: string; label: string; explorerUrl: string | null }) => void;
  notifyConfirmed: (hash: string) => void;
  dismiss: (hash: string) => void;
};

type FeedLike = {
  refreshFeed: () => Promise<void>;
  setPosts: (updater: (prev: Post[]) => Post[]) => void;
};

type ContractLike = {
  getReadContract: () => Promise<any>;
  getWriteContract: () => Promise<any>;
};

type RunContractTxLike = (
  label: string,
  txFn: () => Promise<any>,
  parseReceipt?: (receipt: any) => Promise<any>
) => Promise<any>;

type PosterApprovalLike = {
  setApprovalRequired: (v: boolean) => void;
  setApprovalRequested: (v: boolean) => void;
  checkPosterAllowed: (addr: string) => Promise<{ allowed: boolean; requested: boolean }>;
};

export function useMintPostFlow(params: {
  walletAddress: string | null;
  chainId: string | null;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  isImageLoading: boolean;
  ipfsConfigured: boolean;
  uploadedImageBlob: Blob | null;
  uploadedImageFilename: string;
  resetMedia: () => void;
  closeComposer: () => void;
  contract: ContractLike;
  feed: FeedLike;
  runContractTx: RunContractTxLike;
  txNotifications: TxNotificationsLike;
  setStatus: (s: string) => void;
  posterApproval: PosterApprovalLike;
}) {
  const {
    walletAddress,
    chainId,
    draft,
    setDraft,
    isImageLoading,
    ipfsConfigured,
    uploadedImageBlob,
    uploadedImageFilename,
    resetMedia,
    closeComposer,
    contract,
    feed,
    runContractTx,
    txNotifications,
    setStatus,
    posterApproval
  } = params;

  const [isPosting, setIsPosting] = useState(false);
  const postingInFlightRef = useRef(false);

  const mintPost = useCallback(async () => {
    if (postingInFlightRef.current) return;
    postingInFlightRef.current = true;
    setIsPosting(true);

    try {
      if (!walletAddress) {
        requestConnectNudge();
        setStatus("Connect your wallet first.");
        return;
      }

      try {
        const { allowed, requested } = await posterApproval.checkPosterAllowed(walletAddress);
        if (!allowed) {
          posterApproval.setApprovalRequired(true);
          posterApproval.setApprovalRequested(Boolean(requested));
          closeComposer();
          setStatus(
            requested
              ? "Posting is in closed beta. Approval requested — wait for an admin to approve your wallet."
              : "Posting is in closed beta. Request approval to post."
          );
          return;
        }

        posterApproval.setApprovalRequired(false);
        posterApproval.setApprovalRequested(false);
      } catch {
        // If the pre-check fails, let the mint attempt proceed and surface the revert.
      }

      if (isImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        return;
      }

      const bodyTrimmed = (draft.body || "").trim();
      const imageUrlTrimmed = (draft.imageUrl || "").trim();
      const imageDataUrlTrimmed = (draft.imageDataUrl || "").trim();
      if (!bodyTrimmed && !imageUrlTrimmed && !imageDataUrlTrimmed) {
        setStatus("Add text or attach media (image/video) to post.");
        return;
      }

      const writeContract = await contract.getWriteContract();

      const hasMedia = Boolean(uploadedImageBlob || imageUrlTrimmed || imageDataUrlTrimmed);
      const willUseIpfs = ipfsConfigured && hasMedia;

      const processingToastId = willUseIpfs ? makeLocalNoticeId() : null;
      if (processingToastId) {
        txNotifications.notifyPending({ hash: processingToastId, label: "Preparing post…", explorerUrl: null });
      }

      let metadataURI = "";
      let imageRefForUi = imageDataUrlTrimmed || imageUrlTrimmed;
      let animationUrlForUi: string | undefined;

      if (willUseIpfs) {
        setStatus("Uploading to IPFS (Pinata)...");
        if (processingToastId) {
          txNotifications.notifyPending({ hash: processingToastId, label: "Uploading to IPFS…", explorerUrl: null });
        }
        const built = await buildIpfsTokenUri({
          draft,
          imageBlob: uploadedImageBlob,
          imageFilename: uploadedImageFilename
        });
        metadataURI = built.tokenUri;
        imageRefForUi = built.imageRef || (built.animationRef ? "" : imageRefForUi);
        animationUrlForUi = built.animationRef || undefined;
      } else {
        metadataURI = createMetadataUri(draft);
        const maxTokenUriChars = 140_000;
        if (metadataURI.length > maxTokenUriChars) {
          setStatus(
            "Post metadata is too large to mint on-chain. Use IPFS pinning (recommended via a backend), or use a much smaller image."
          );
          return;
        }
      }

      const minted = await runContractTx(
        "Mint post NFT",
        () => (writeContract as any).mintPost(metadataURI),
        async (receipt) => parseMintPostReceipt(receipt)
      );

      if (!minted?.mintedTokenId) {
        setStatus("Mint confirmed, but tokenId could not be parsed. Reloading feed...");
        await feed.refreshFeed();
        if (processingToastId) txNotifications.dismiss(processingToastId);
        return;
      }

      const newPost: Post = {
        tokenId: minted.mintedTokenId,
        chainId: normalizeChainIdToString(chainId),
        title: draft.title,
        body: draft.body,
        image: imageRefForUi,
        animationUrl: animationUrlForUi,
        metadataURI,
        author: minted.mintedAuthor,
        mintTxHash: minted.mintTxHash,
        mintBlockNumber: minted.mintBlockNumber,
        mintTimestamp: Math.floor(Date.now() / 1000),
        likes: 0,
        comments: 0,
        saves: 0,
        tipsWei: 0n
      };

      setDraft({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
      resetMedia();
      closeComposer();

      if (processingToastId && metadataURI.startsWith("ipfs://")) {
        txNotifications.notifyPending({
          hash: processingToastId,
          label: "Post created — finalizing media…",
          explorerUrl: null
        });

        await waitForUrlReachable(ipfsToHttp(metadataURI), 10, 650);
        const meta = await waitForMetadataReady(metadataURI, 10, 650);

        const mediaRef =
          (typeof meta.animation_url === "string" && meta.animation_url.trim()) ||
          (typeof meta.image === "string" && meta.image.trim()) ||
          "";

        if (mediaRef && mediaRef.startsWith("ipfs://")) {
          await waitForUrlReachable(ipfsToHttp(mediaRef), 12, 650);
        }
      }

      feed.setPosts((prev) => {
        const newKey = `${newPost.chainId ?? ""}:${newPost.tokenId}`;
        return [newPost, ...prev.filter((p) => `${p.chainId ?? ""}:${p.tokenId}` !== newKey)];
      });
      if (processingToastId) {
        txNotifications.notifyConfirmed(processingToastId);
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      postingInFlightRef.current = false;
      setIsPosting(false);
    }
  }, [
    walletAddress,
    posterApproval,
    closeComposer,
    setStatus,
    isImageLoading,
    draft,
    contract,
    ipfsConfigured,
    uploadedImageBlob,
    uploadedImageFilename,
    runContractTx,
    setDraft,
    resetMedia,
    feed,
    txNotifications,
    chainId
  ]);

  return useMemo(
    () => ({
      isPosting,
      mintPost
    }),
    [isPosting, mintPost]
  );
}
