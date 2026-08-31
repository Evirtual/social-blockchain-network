import { useCallback, useMemo, useRef, useState } from "react";
import type { Draft, Post } from "@types";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { bestEffortUnpinCids, collectReferencedIpfsCidsFromPosts, extractIpfsCid } from "@features/ipfs";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { makeLocalNoticeId, normalizeChainIdToString } from "../services/utils";
import { parseMintPostReceipt, waitForMetadataReady } from "../services/mintPost";
import { preparePostMetadata } from "@features/post/services/preparePostMetadata";
import { validateDraftForMint } from "../services/validateDraftForMint";
import type { ReadContractFactory, WriteContractFactory } from "@features/contract/types";

type TxNotificationsLike = {
  notifyPending: (p: { hash: string; label: string; explorerUrl: string | null }) => void;
  notifyConfirmed: (hash: string, label?: string) => void;
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
  feedPosts: Post[];
  runContractTx: RunContractTxLike;
  txNotifications: TxNotificationsLike;
  setStatus: (s: string) => void;
  posterApproval: PosterApprovalLike;
  isUnsupportedNetwork: boolean;
  unsupportedNetworkMessage: string | null;
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
    feedPosts,
    runContractTx,
    txNotifications,
    setStatus,
    posterApproval,
    isUnsupportedNetwork,
    unsupportedNetworkMessage
  } = params;

  const [isPosting, setIsPosting] = useState(false);
  const postingInFlightRef = useRef(false);

  const mintPost = useCallback(async () => {
    if (postingInFlightRef.current) return;
    postingInFlightRef.current = true;
    setIsPosting(true);
    setStatus("Preparing post...");

    let pinnedCidsToCleanup: Set<string> | null = null;
    let protectReferencedIn: Set<string> | null = null;
    let processingToastId: string | null = makeLocalNoticeId();

    const updateProcessingToast = (label: string) => {
      if (!processingToastId) return;
      txNotifications.notifyPending({ hash: processingToastId, label, explorerUrl: null });
    };

    const dismissProcessingToast = () => {
      if (!processingToastId) return;
      txNotifications.dismiss(processingToastId);
      processingToastId = null;
    };

    updateProcessingToast("Preparing post...");

    try {
      if (!walletAddress) {
        requestConnectNudge();
        setStatus("Connect your wallet first.");
        dismissProcessingToast();
        return;
      }

      if (isUnsupportedNetwork) {
        setStatus(unsupportedNetworkMessage ?? "Wrong network. Select a supported network before posting.");
        dismissProcessingToast();
        return;
      }

      try {
        setStatus("Checking posting access...");
        updateProcessingToast("Checking posting access...");
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
          dismissProcessingToast();
          return;
        }

        posterApproval.setApprovalRequired(false);
        posterApproval.setApprovalRequested(false);
      } catch {
        // If the pre-check fails, let the mint attempt proceed and surface the revert.
      }

      if (isImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        dismissProcessingToast();
        return;
      }

      const titleTrimmed = draft.title.trim();
      const validation = validateDraftForMint({ draft, uploadedImageBlob });
      if (!validation.ok) {
        setStatus(validation.error);
        dismissProcessingToast();
        return;
      }
      const bodyTrimmed = validation.bodyTrimmed;

      const willUseIpfs = ipfsConfigured && validation.hasMedia;
      if (willUseIpfs) {
        updateProcessingToast("Uploading to IPFS...");
      }
      if (willUseIpfs) {
        setStatus("Uploading to IPFS (Pinata)...");
      }

      const prepared = await preparePostMetadata({
        draft,
        hasMedia: validation.hasMedia,
        ipfsConfigured,
        uploadedImageBlob,
        uploadedImageFilename,
        pinNameContext: {
          kind: "post",
          chainId: chainId ?? undefined,
          author: walletAddress
        }
      });

      let metadataURI = "";
      let imageRefForUi = validation.imageDataUrlTrimmed || validation.imageUrlTrimmed;
      let animationUrlForUi: string | undefined;

      if (!prepared.ok) {
        setStatus(
          "Post metadata is too large to mint on-chain. Use IPFS pinning (recommended via a backend), or use a much smaller image."
        );
        dismissProcessingToast();
        return;
      }

      if (willUseIpfs) {
        pinnedCidsToCleanup = new Set<string>();

        const metaCid = extractIpfsCid(prepared.tokenUri);
        if (metaCid) pinnedCidsToCleanup.add(metaCid);
        const imageCid = prepared.imageRef ? extractIpfsCid(prepared.imageRef) : null;
        if (imageCid) pinnedCidsToCleanup.add(imageCid);
        const animCid = prepared.animationRef ? extractIpfsCid(prepared.animationRef) : null;
        if (animCid) pinnedCidsToCleanup.add(animCid);

        protectReferencedIn = collectReferencedIpfsCidsFromPosts(feedPosts);
      }

      metadataURI = prepared.tokenUri;
      imageRefForUi = prepared.imageRef || (prepared.animationRef ? "" : imageRefForUi);
      animationUrlForUi = prepared.animationRef || undefined;
      setStatus("Confirm in your wallet...");
      if (willUseIpfs) {
        updateProcessingToast("Confirm in wallet...");
      } else {
        // Avoid a duplicate non-tx toast; runContractTx already shows "confirm in wallet" toasts.
        dismissProcessingToast();
      }
      const writeContract = await contract.getWriteContract();
      const minted = await runContractTx(
        "Mint post NFT",
        () => writeContract.mintPost(metadataURI, titleTrimmed, bodyTrimmed),
        async (receipt) => parseMintPostReceipt(receipt)
      );

      pinnedCidsToCleanup = null;
      protectReferencedIn = null;

      if (!minted?.mintedTokenId) {
        setStatus("Mint confirmed, but tokenId could not be parsed. Reloading feed...");
        await feed.refreshFeed();
        dismissProcessingToast();
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

      setDraft({ title: "", body: "", imageUrl: "", imageDataUrl: "", videoTrim: undefined });
      resetMedia();
      closeComposer();

      feed.setPosts((prev) => {
        const newKey = `${newPost.chainId ?? ""}:${newPost.tokenId}`;
        return [newPost, ...prev.filter((p) => `${p.chainId ?? ""}:${p.tokenId}` !== newKey)];
      });

      if (processingToastId && metadataURI.startsWith("ipfs://")) {
        const toastId = processingToastId;
        txNotifications.notifyPending({ hash: toastId, label: "Post created - finalizing media...", explorerUrl: null });

        void (async () => {
          try {
            await waitForMetadataReady(metadataURI, 5, 900);
          } catch {
            // ignore; mint already succeeded
          } finally {
            txNotifications.notifyConfirmed(toastId, "Post created");
          }
        })();
      } else if (processingToastId) {
        txNotifications.notifyConfirmed(processingToastId);
      }
    } catch (error) {
      if (pinnedCidsToCleanup && pinnedCidsToCleanup.size > 0) {
        await bestEffortUnpinCids(pinnedCidsToCleanup, {
          protectReferencedIn: protectReferencedIn ?? undefined
        });
      }
      dismissProcessingToast();
      setStatusFromError(setStatus, error as ErrorInput);
    } finally {
      postingInFlightRef.current = false;
      setIsPosting(false);
    }
  }, [
    walletAddress,
    isUnsupportedNetwork,
    unsupportedNetworkMessage,
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
    feedPosts,
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
