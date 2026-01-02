import { useCallback, useMemo, useRef, useState } from "react";
import type { Draft, Post } from "@types";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { getErrorMessage, type ErrorInput } from "@shared/lib/errors";
import { ipfsToHttp } from "@features/ipfs";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { makeLocalNoticeId, normalizeChainIdToString } from "../services/utils";
import { parseMintPostReceipt, waitForMetadataReady, waitForUrlReachable } from "../services/mintPost";
import { preparePostMetadata } from "@features/post/services/preparePostMetadata";
import { getDraftMediaState } from "@features/post/services/draftMediaState";
import type { ReadContractFactory, WriteContractFactory } from "@features/contract";

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
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;
};

type RunContractTxLike = <T>(
  label: string,
  txFn: () => Promise<TransactionResponse>,
  parseReceipt?: (receipt: TransactionReceipt) => Promise<T> | T
) => Promise<T | undefined>;

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
              ? "Posting is in closed beta. Approval requested - wait for an admin to approve your wallet."
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

      const { bodyTrimmed, imageUrlTrimmed, imageDataUrlTrimmed, hasMedia } = getDraftMediaState(
        draft,
        uploadedImageBlob
      );
      const titleTrimmed = draft.title.trim();
      if (!bodyTrimmed && !imageUrlTrimmed && !imageDataUrlTrimmed) {
        setStatus("Add text or attach media (image/video) to post.");
        return;
      }

      const writeContract = await contract.getWriteContract();

      const prepared = await preparePostMetadata({
        draft,
        hasMedia,
        ipfsConfigured,
        uploadedImageBlob,
        uploadedImageFilename
      });
      const willUseIpfs = prepared.willUseIpfs;

      const processingToastId = willUseIpfs ? makeLocalNoticeId() : null;
      if (processingToastId) {
        txNotifications.notifyPending({ hash: processingToastId, label: "Preparing post...", explorerUrl: null });
      }

      let metadataURI = "";
      let imageRefForUi = imageDataUrlTrimmed || imageUrlTrimmed;
      let animationUrlForUi: string | undefined;

      if (willUseIpfs) {
        setStatus("Uploading to IPFS (Pinata)...");
        if (processingToastId) {
          txNotifications.notifyPending({ hash: processingToastId, label: "Uploading to IPFS...", explorerUrl: null });
        }
      }

      if (!prepared.ok) {
        setStatus(
          "Post metadata is too large to mint on-chain. Use IPFS pinning (recommended via a backend), or use a much smaller image."
        );
        return;
      }

      metadataURI = prepared.tokenUri;
      imageRefForUi = prepared.imageRef || (prepared.animationRef ? "" : imageRefForUi);
      animationUrlForUi = prepared.animationRef || undefined;
      const minted = await runContractTx(
        "Mint post NFT",
        () => writeContract.mintPost(metadataURI, titleTrimmed, bodyTrimmed),
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
        title: titleTrimmed,
        body: bodyTrimmed,
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
          label: "Post created - finalizing media...",
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
      setStatus(getErrorMessage(error as ErrorInput));
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
