import { useCallback, useRef, useState } from "react";

import type { Draft, Post } from "@types";
import { createMetadataUri } from "../../metadata";
import { getErrorMessage } from "@shared/lib/errors";
import { buildIpfsTokenUri, collectIpfsCidsFromTokenUri } from "../../ipfs";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { EMPTY_DRAFT, MAX_ONCHAIN_TOKEN_URI_CHARS } from "../services/editPost/constants";
import { buildBestImageDataUrl } from "../services/editPost/imageDataUrl";
import { bestEffortFinalizeIpfsMedia } from "../services/editPost/ipfsFinalize";
import { makeLocalNoticeId } from "@shared/lib/ids";
import { collectPinnedCidsFromBuilt } from "../services/editPost/pinning";

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

type RunContractTxLike = <T = unknown>(
  label: string,
  send: () => any,
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
  getReadContract: () => Promise<any>;
  getWriteContract: () => Promise<any>;
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
    (post: Post) => {
      void (async () => {
        try {
          const readContract = await getReadContract();
          const frozen = (await (readContract as any).isPostFrozen(BigInt(post.tokenId))) as boolean;
          if (frozen && !isOwner) {
            setStatus("This post is frozen and can no longer be edited.");
            return;
          }
        } catch {
          // ignore and allow edit
        }

        setEditingTokenId(post.tokenId);
        setEditDraft({
          title: post.title,
          body: post.body,
          imageUrl: post.animationUrl ?? post.image,
          imageDataUrl: ""
        });
        setEditUploadedImageBlob(null);
        setEditUploadedImageFilename("");
      })();
    },
    [getReadContract, isOwner, setStatus]
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
    try {
      if (!walletAddress) {
        requestConnectNudge();
        setStatus("Connect your wallet first.");
        return;
      }
      if (!editingTokenId) return;
      if (isEditImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        return;
      }

      const bodyTrimmed = (editDraft.body || "").trim();
      const imageUrlTrimmed = (editDraft.imageUrl || "").trim();
      const imageDataUrlTrimmed = (editDraft.imageDataUrl || "").trim();
      const hasMedia = Boolean(editUploadedImageBlob || imageUrlTrimmed || imageDataUrlTrimmed);
      if (!bodyTrimmed && !hasMedia) {
        setStatus("Add text or attach media (image/video) to post.");
        return;
      }

      const writeContract = await getWriteContract();
      const tokenIdBig = BigInt(editingTokenId);

      // Capture current tokenURI + related IPFS CIDs before we update it.
      // We only unpin after the tx succeeds.
      let oldPinnedCids: Set<string> | null = null;
      try {
        if (ipfsConfigured) {
          const readContract = await getReadContract();
          const oldTokenUri = (await (readContract as any).tokenURI(tokenIdBig)) as string;
          oldPinnedCids = await collectIpfsCidsFromTokenUri(oldTokenUri);
        }
      } catch {
        oldPinnedCids = null;
      }

      // Match create-post UX: show an immediate "initializing" toast while we prepare the update
      // (e.g. building metadata / uploading to IPFS) before the wallet confirmation step.
      processingToastId = makeLocalNoticeId();
      txNotifications.notifyPending({ hash: processingToastId, label: "Updating post…", explorerUrl: null });

      // Existing post (used for media-type hints and permissioning).
      const post = feed.posts.find((p) => p.tokenId === editingTokenId);

      let tokenUri = "";
      let newPinnedCids: Set<string> | null = null;

      // Used for immediate UI update (avoid relying solely on metadata fetch timing).
      let nextUiImage = "";
      let nextUiAnimationUrl: string | undefined;

      // Match mint behavior: only pin to IPFS when media is present.
      const willUseIpfs = ipfsConfigured && hasMedia;

      if (willUseIpfs) {
        setStatus("Uploading update to IPFS (Pinata)...");
        txNotifications.notifyPending({ hash: processingToastId, label: "Uploading update to IPFS…", explorerUrl: null });

        const mediaTypeHint = editUploadedImageBlob
          ? (((editUploadedImageBlob as any)?.type?.startsWith?.("video/") ?? false) ? "video" : "image")
          : post?.animationUrl
            ? "video"
            : post?.image
              ? "image"
              : undefined;

        const built = await buildIpfsTokenUri({
          draft: editDraft,
          imageBlob: editUploadedImageBlob,
          imageFilename: editUploadedImageFilename,
          mediaTypeHint
        });
        tokenUri = built.tokenUri;

        nextUiImage = built.imageRef || (built.animationRef ? "" : imageDataUrlTrimmed || imageUrlTrimmed);
        nextUiAnimationUrl = built.animationRef || undefined;

        // Prefer the known refs from buildIpfsTokenUri (no extra gateway fetch needed).
        newPinnedCids = collectPinnedCidsFromBuilt({
          tokenUri: built.tokenUri,
          imageRef: built.imageRef,
          animationRef: built.animationRef
        });
      } else {
        tokenUri = createMetadataUri(editDraft);
        nextUiImage = imageDataUrlTrimmed || imageUrlTrimmed;
        nextUiAnimationUrl = undefined;
        if (tokenUri.length > MAX_ONCHAIN_TOKEN_URI_CHARS) {
          txNotifications.dismiss(processingToastId);
          processingToastId = null;
          setStatus("Updated metadata is too large. Configure IPFS (Pinata) or use a smaller image.");
          return;
        }

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
          ? () => (writeContract as any).adminUpdatePostURI(tokenIdBig, tokenUri)
          : () => (writeContract as any).updatePostURI(tokenIdBig, tokenUri);

      await runContractTx("Edit post", send);

      if (willUseIpfs && tokenUri.startsWith("ipfs://")) {
        const finalizingToastId = makeLocalNoticeId();
        txNotifications.notifyPending({
          hash: finalizingToastId,
          label: "Post updated — finalizing media…",
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
          if (p.tokenId !== editingTokenId) return p;
          return {
            ...p,
            body: editDraft.body,
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
        void bestEffortUnpinCidsSafe(toRemove, { chainId, tokenIds: [editingTokenId] });
      }

      cancelEditPost();
      await feed.refreshFeed();
    } catch (error) {
      const message = getErrorMessage(error);
      if (processingToastId) {
        txNotifications.notifyFailed({ hash: processingToastId, label: "Updating post", error: message });
      }
      setStatus(message);
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
