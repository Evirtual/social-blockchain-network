import { useCallback, useRef, useState } from "react";

import type { Draft, Post } from "@types";
import { getErrorMessage, setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { collectIpfsCidsFromTokenUri } from "@features/ipfs";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { EMPTY_DRAFT } from "@features/post/services/draftConstants";
import { buildBestImageDataUrl } from "../services/editPost/imageDataUrl";
import { bestEffortFinalizeIpfsMedia } from "../services/editPost/ipfsFinalize";
import { makeLocalNoticeId } from "@shared/lib/ids";
import { collectPinnedCidsFromBuilt } from "../services/editPost/pinning";
import { parsePostKey, postKey } from "@features/post/services";
import { preparePostMetadata } from "@features/post/services/preparePostMetadata";
import { getDraftMediaState } from "@features/post/services/draftMediaState";
import type { TransactionResponse } from "ethers";
import type { ReadContractFactory, WriteContractFactory } from "@features/contract";

type TxNotificationsLike = {
  notifyPending: (args: { hash: string; label: string; explorerUrl: string | null }) => void;
  notifyConfirmed: (hash: string) => void;
  notifyFailed: (args: { hash: string; label: string; error: string }) => void;
  dismiss: (hash: string) => void;
};

type FeedLike = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  refreshFeed: () => Promise<void>;
};

type RunContractTxLike = <T = void>(
  label: string,
  send: () => Promise<TransactionResponse>,
  onSuccess?: () => T
) => Promise<T | undefined>;

type BestEffortUnpinSafe = (
  cids: Iterable<string>,
  exclude?: { chainId?: string | null; tokenIds?: Iterable<string> }
) => Promise<void>;

export function useEditPostFlow(args: {
  walletAddress: string | null;
  chainId: string | null;
  isOwner: boolean;
  ipfsConfigured: boolean;
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;
  runContractTx: RunContractTxLike;
  feed: FeedLike;
  setStatus: (value: string) => void;
  txNotifications: TxNotificationsLike;
  bestEffortUnpinCidsSafe: BestEffortUnpinSafe;
}) {
  const {
    walletAddress,
    chainId,
    isOwner,
    ipfsConfigured,
    getReadContract,
    getWriteContract,
    runContractTx,
    feed,
    setStatus,
    txNotifications,
    bestEffortUnpinCidsSafe
  } = args;

  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editUploadedImageBlob, setEditUploadedImageBlob] = useState<Blob | null>(null);
  const [editUploadedImageFilename, setEditUploadedImageFilename] = useState<string>("");
  const editPreviewObjectUrlRef = useRef<string | null>(null);
  const [isEditImageLoading, setIsEditImageLoading] = useState(false);

  const cancelEditPost = useCallback(() => {
    setEditingTokenId(null);
    setEditDraft(EMPTY_DRAFT);
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
    setIsEditImageLoading(false);

    if (editPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(editPreviewObjectUrlRef.current);
      editPreviewObjectUrlRef.current = null;
    }
  }, []);

  const startEditPost = useCallback(
    (post: Readonly<Post>) => {
      setEditingTokenId(postKey(post));
      setEditDraft({
        title: post.title,
        body: post.body,
        imageUrl: post.animationUrl ?? post.image,
        imageDataUrl: ""
      });
      setEditUploadedImageBlob(null);
      setEditUploadedImageFilename("");

      void (async () => {
        try {
          const readContract = await getReadContract();
          const frozen = (await readContract.isPostFrozen(BigInt(post.tokenId))) as boolean;
          if (frozen && !isOwner) {
            setStatus("This post is frozen and can no longer be edited.");
            cancelEditPost();
          }
        } catch {
          // ignore and allow edit
        }
      })();
    },
    [getReadContract, isOwner, setStatus, cancelEditPost]
  );

  const onEditSelectFile = useCallback(
    async (file: File | null) => {
      try {
        if (!file) return;
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          setStatus("Please select an image or video file.");
          return;
        }

        if (isVideo && !ipfsConfigured) {
          setStatus("Video uploads require IPFS pinning (Pinata). Configure VITE_PINATA_JWT to continue.");
          return;
        }

        setIsEditImageLoading(true);
        setStatus(isVideo ? "Preparing uploaded video..." : "Processing uploaded image...");

        if (editPreviewObjectUrlRef.current) {
          URL.revokeObjectURL(editPreviewObjectUrlRef.current);
          editPreviewObjectUrlRef.current = null;
        }

        if (isVideo) {
          const objectUrl = URL.createObjectURL(file);
          editPreviewObjectUrlRef.current = objectUrl;
          setEditDraft((prev) => ({ ...prev, imageDataUrl: objectUrl, imageUrl: "" }));
          setEditUploadedImageBlob(file);
          setEditUploadedImageFilename(file.name || "post-video");
          setStatus("Uploaded video ready.");
          return;
        }

        const best = await buildBestImageDataUrl({ file, ipfsConfigured, draft: editDraft });
        if (!best.ok) {
          setStatus(best.error);
          return;
        }

        const blobRes = await fetch(best.dataUrl);
        const blob = await blobRes.blob();

        setEditDraft((prev) => ({ ...prev, imageDataUrl: best.dataUrl, imageUrl: "" }));
        setEditUploadedImageBlob(blob);
        setEditUploadedImageFilename(file.name || "post-image.jpg");
        setStatus("Uploaded image ready.");
      } catch {
        setStatus("Failed to read image.");
      } finally {
        setIsEditImageLoading(false);
      }
    },
    [ipfsConfigured, editDraft, setStatus]
  );

  const onEditClearImage = useCallback(() => {
    setEditDraft((d) => ({ ...d, imageUrl: "", imageDataUrl: "" }));
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
    if (editPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(editPreviewObjectUrlRef.current);
      editPreviewObjectUrlRef.current = null;
    }
  }, []);

  const saveEditedPost = useCallback(async () => {
    let processingToastId: string | null = null;
    let willUseIpfs = false;
    let txSucceeded = false;
    let oldPinnedCids: Set<string> | null = null;
    let newPinnedCids: Set<string> | null = null;
    let tokenUri = "";
    try {
      if (!walletAddress) {
        requestConnectNudge();
        setStatus("Connect your wallet first.");
        return;
      }
      if (!editingTokenId) return;
      const parsedKey = parsePostKey(editingTokenId);
      if (!parsedKey) return;
      const { tokenId: editingTokenValue, chainId: editingPostChainId } = parsedKey;
      if (isEditImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        return;
      }

      const { bodyTrimmed, imageUrlTrimmed, imageDataUrlTrimmed, hasMedia } = getDraftMediaState(
        editDraft,
        editUploadedImageBlob
      );
      const titleTrimmed = editDraft.title.trim();
      if (!bodyTrimmed && !hasMedia) {
        setStatus("Add text or attach media (image/video) to post.");
        return;
      }

      const writeContract = await getWriteContract();
      const tokenIdBig = BigInt(editingTokenValue);

      // Capture current tokenURI + related IPFS CIDs before we update it.
      // We only unpin after the tx succeeds.
      try {
        if (ipfsConfigured) {
          const readContract = await getReadContract();
          const oldTokenUri = (await readContract.tokenURI(tokenIdBig)) as string;
          oldPinnedCids = await collectIpfsCidsFromTokenUri(oldTokenUri);
        }
      } catch {
        oldPinnedCids = null;
      }

      // Match create-post UX: show an immediate "initializing" toast while we prepare the update
      // (e.g. building metadata / uploading to IPFS) before the wallet confirmation step.
      processingToastId = makeLocalNoticeId();
      txNotifications.notifyPending({ hash: processingToastId, label: "Updating post...", explorerUrl: null });

      // Existing post (used for media-type hints and permissioning).
      const post = feed.posts.find((p) => postKey(p) === editingTokenId);

      // Used for immediate UI update (avoid relying solely on metadata fetch timing).
      let nextUiImage = "";
      let nextUiAnimationUrl: string | undefined;

      const mediaTypeHint = editUploadedImageBlob
        ? (editUploadedImageBlob.type?.startsWith("video/") ? "video" : "image")
        : post?.animationUrl
          ? "video"
          : post?.image
            ? "image"
            : undefined;

      const prepared = await preparePostMetadata({
        draft: editDraft,
        hasMedia,
        ipfsConfigured,
        uploadedImageBlob: editUploadedImageBlob,
        uploadedImageFilename: editUploadedImageFilename,
        mediaTypeHint,
        pinNameContext: {
          kind: "post",
          chainId: editingPostChainId ?? chainId ?? undefined,
          author: walletAddress,
          tokenId: editingTokenValue
        }
      });

      willUseIpfs = prepared.willUseIpfs;
      if (willUseIpfs) {
        setStatus("Uploading update to IPFS (Pinata)...");
        txNotifications.notifyPending({ hash: processingToastId, label: "Uploading update to IPFS...", explorerUrl: null });
      }

      if (!prepared.ok) {
        txNotifications.dismiss(processingToastId);
        processingToastId = null;
        setStatus("Updated metadata is too large. Configure IPFS (Pinata) or use a smaller image.");
        return;
      }

      tokenUri = prepared.tokenUri;
      nextUiImage = prepared.imageRef || (prepared.animationRef ? "" : imageDataUrlTrimmed || imageUrlTrimmed);
      nextUiAnimationUrl = prepared.animationRef || undefined;

      if (willUseIpfs) {
        // Prefer the known refs from buildIpfsTokenUri (no extra gateway fetch needed).
        newPinnedCids = collectPinnedCidsFromBuilt({
          tokenUri: prepared.tokenUri,
          imageRef: prepared.imageRef,
          animationRef: prepared.animationRef
        });
      } else {
        // Not pinning in this mode.
        newPinnedCids = new Set<string>();
      }

      // Replace the local “preparing/updating” notice with the real tx lifecycle toasts.
      if (processingToastId) {
        txNotifications.dismiss(processingToastId);
        processingToastId = null;
      }
      const author = post?.author;
      const isMine = !!author && walletAddress.toLowerCase() === author.toLowerCase();
      const send =
        isOwner && !isMine
          ? () => writeContract.adminUpdatePostURI(tokenIdBig, tokenUri, titleTrimmed, bodyTrimmed)
          : () => writeContract.updatePostURI(tokenIdBig, tokenUri, titleTrimmed, bodyTrimmed);

      await runContractTx("Edit post", send);
      txSucceeded = true;

      if (willUseIpfs && tokenUri.startsWith("ipfs://")) {
        const finalizingToastId = makeLocalNoticeId();
        txNotifications.notifyPending({
          hash: finalizingToastId,
          label: "Post updated - finalizing media...",
          explorerUrl: null
        });

        try {
          await bestEffortFinalizeIpfsMedia(tokenUri);
        } catch {
          // ignore
        } finally {
          // Don't leave the local toast stuck.
          txNotifications.notifyConfirmed(finalizingToastId);
        }
      }

      // Optimistically apply the edit locally so the UI doesn't appear to lose text
      // due to gateway timing or metadata fetch failures.
      feed.setPosts((prev) =>
        prev.map((p) => {
          if (postKey(p) !== editingTokenId) return p;
          return {
            ...p,
            title: titleTrimmed,
            body: bodyTrimmed,
            image: nextUiImage,
            animationUrl: nextUiAnimationUrl,
            metadataURI: tokenUri
          };
        })
      );

      // Best-effort cleanup: unpin old metadata/media that is no longer referenced.
      if (ipfsConfigured && oldPinnedCids && newPinnedCids) {
        const toRemove: string[] = [];
        for (const cid of oldPinnedCids) {
          if (!newPinnedCids.has(cid)) toRemove.push(cid);
        }
        void bestEffortUnpinCidsSafe(toRemove, {
          chainId: editingPostChainId ?? chainId,
          tokenIds: [editingTokenValue]
        });
      }

      cancelEditPost();
      // Delay refresh so subgraph/indexers have time to catch up and we avoid UI reverting.
      setTimeout(() => {
        void feed.refreshFeed();
      }, 15_000);
    } catch (error) {
      // If we uploaded new metadata/media but the tx failed, unpin the newly uploaded CIDs
      // so we don't leak unused pins. Never unpin any CID that was already referenced by
      // the current on-chain tokenURI.
      if (!txSucceeded && ipfsConfigured && willUseIpfs && newPinnedCids && newPinnedCids.size > 0) {
        const safeToRemove: string[] = [];
        for (const cid of newPinnedCids) {
          if (!oldPinnedCids || !oldPinnedCids.has(cid)) safeToRemove.push(cid);
        }
        if (safeToRemove.length) {
          void bestEffortUnpinCidsSafe(safeToRemove);
        }
      }

      const message = getErrorMessage(error as ErrorInput);
      if (processingToastId) {
        txNotifications.notifyFailed({ hash: processingToastId, label: "Updating post", error: message });
      }
      setStatusFromError(setStatus, error as ErrorInput);
    }
  }, [
    walletAddress,
    isOwner,
    editingTokenId,
    isEditImageLoading,
    editDraft,
    getReadContract,
    getWriteContract,
    ipfsConfigured,
    editUploadedImageBlob,
    editUploadedImageFilename,
    runContractTx,
    cancelEditPost,
    feed,
    setStatus,
    txNotifications,
    bestEffortUnpinCidsSafe,
    chainId
  ]);

  return {
    editingTokenId,
    editDraft,
    isEditImageLoading,
    setEditDraft,
    onEditSelectFile,
    onEditClearImage,
    startEditPost,
    cancelEditPost,
    saveEditedPost
  };
}
