import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import type { Draft, Post } from "../types";
import { createMetadataUri } from "../lib/metadata";
import { getErrorMessage } from "../lib/errors";
import { hasPinata } from "../ipfs";
import { buildIpfsTokenUri } from "../lib/ipfsTokenUri";
import { useContract } from "./ContractContext";
import { useFeed } from "./FeedContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";

export type SocialActionsContextValue = {
  isOwner: boolean;

  // Per-post UI state + actions
  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  tipDrafts: Record<string, string>;
  commentDrafts: Record<string, string>;

  setEditDraft: React.Dispatch<React.SetStateAction<Draft>>;

  onTipDraftChange: (tokenId: string, value: string) => void;
  onCommentDraftChange: (tokenId: string, value: string) => void;

  onEditSelectFile: (file: File | null) => Promise<void>;
  onEditClearImage: () => void;

  startEditPost: (post: Post) => void;
  cancelEditPost: () => void;
  saveEditedPost: () => Promise<void>;

  burnPost: (tokenId: string) => Promise<void>;
  freezePost: (tokenId: string) => Promise<void>;

  handleAction: (tokenId: string, action: "like" | "comment" | "share") => Promise<void>;
  handleTip: (tokenId: string) => Promise<void>;

  withdrawTips: () => Promise<void>;
};

const SocialActionsContext = createContext<SocialActionsContextValue | null>(null);

export function SocialActionsProvider({ children }: { children: React.ReactNode }) {
  const { walletAddress, refreshWalletPanel } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();
  const feed = useFeed();
  const { runContractTx } = useContractTx();

  const getReadContract = contract.getReadContract;
  const getWriteContract = contract.getWriteContract;

  const ipfsConfigured = useMemo(() => hasPinata(), []);

  const isOwner = contract.isOwner;

  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
  const [editUploadedImageBlob, setEditUploadedImageBlob] = useState<Blob | null>(null);
  const [editUploadedImageFilename, setEditUploadedImageFilename] = useState<string>("");
  const editPreviewObjectUrlRef = useRef<string | null>(null);
  const [isEditImageLoading, setIsEditImageLoading] = useState(false);

  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const onTipDraftChange = useCallback((tokenId: string, value: string) => {
    setTipDrafts((prev) => ({ ...prev, [tokenId]: value }));
  }, []);

  const onCommentDraftChange = useCallback((tokenId: string, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [tokenId]: value }));
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
        setEditDraft({ title: post.title, body: post.body, imageUrl: post.image, imageDataUrl: "" });
        setEditUploadedImageBlob(null);
        setEditUploadedImageFilename("");
      })();
    },
    [getReadContract, isOwner, setStatus]
  );

  const cancelEditPost = useCallback(() => {
    setEditingTokenId(null);
    setEditDraft({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
    setIsEditImageLoading(false);
  }, []);

  const freezePost = useCallback(
    async (tokenId: string) => {
      try {
        if (!walletAddress) {
          setStatus("Connect your wallet first.");
          return;
        }

        const writeContract = await getWriteContract();
        const ok = await runContractTx<boolean>(
          "Freeze post",
          () => ((writeContract as any).freezePost(BigInt(tokenId)) as any),
          () => true
        );
        if (!ok) return;

        cancelEditPost();
        setStatus("Post frozen. Editing is now disabled for this token.");
      } catch (error) {
        setStatus(getErrorMessage(error));
      }
    },
    [walletAddress, getWriteContract, runContractTx, cancelEditPost, setStatus]
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

        const compressToJpegDataUrl = async (blob: Blob, quality: number, maxDim: number) => {
          const objectUrl = URL.createObjectURL(blob);
          try {
            const img = new Image();
            img.decoding = "async";
            const loaded = new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("Failed to decode image"));
            });
            img.src = objectUrl;
            await loaded;

            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas not supported");
            ctx.drawImage(img, 0, 0, width, height);

            return canvas.toDataURL("image/jpeg", quality);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        };

        const maxDataUrlChars = 90_000;
        const candidates = [
          { q: 0.78, dim: 640 },
          { q: 0.7, dim: 512 },
          { q: 0.62, dim: 512 },
          { q: 0.55, dim: 420 }
        ];
        let best: string | null = null;
        for (const c of candidates) {
          const attempt = await compressToJpegDataUrl(file, c.q, c.dim);
          best = attempt;
          if (attempt.length <= maxDataUrlChars) break;
        }
        if (!best || best.length > maxDataUrlChars) {
          setStatus("Uploaded image is too large. Try a smaller image.");
          return;
        }

        const blobRes = await fetch(best);
        const blob = await blobRes.blob();

        setEditDraft((prev) => ({ ...prev, imageDataUrl: best!, imageUrl: "" }));
        setEditUploadedImageBlob(blob);
        setEditUploadedImageFilename(file.name || "post-image.jpg");
        setStatus("Uploaded image ready.");
      } catch {
        setStatus("Failed to read image.");
      } finally {
        setIsEditImageLoading(false);
      }
    },
    [ipfsConfigured, setStatus]
  );

  const onEditClearImage = useCallback(() => {
    setEditDraft((d) => ({ ...d, imageDataUrl: "" }));
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
    if (editPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(editPreviewObjectUrlRef.current);
      editPreviewObjectUrlRef.current = null;
    }
  }, []);

  const saveEditedPost = useCallback(async () => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }
      if (!editingTokenId) return;
      if (isEditImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        return;
      }

      if (!editDraft.body.trim()) {
        setStatus("Post text is required.");
        return;
      }
      if (!editDraft.imageUrl.trim() && !editDraft.imageDataUrl.trim()) {
        setStatus("Add an image URL or upload an image.");
        return;
      }

      const writeContract = await getWriteContract();
      const tokenIdBig = BigInt(editingTokenId);

      let tokenUri = "";
      if (ipfsConfigured) {
        setStatus("Uploading update to IPFS (Pinata)...");
        const built = await buildIpfsTokenUri({
          draft: editDraft,
          imageBlob: editUploadedImageBlob,
          imageFilename: editUploadedImageFilename
        });
        tokenUri = built.tokenUri;
      } else {
        tokenUri = createMetadataUri(editDraft);
        const maxTokenUriChars = 140_000;
        if (tokenUri.length > maxTokenUriChars) {
          setStatus("Updated metadata is too large. Configure IPFS (Pinata) or use a smaller image.");
          return;
        }
      }

      const post = feed.posts.find((p) => p.tokenId === editingTokenId);
      const author = post?.author;
      const isMine = !!author && walletAddress.toLowerCase() === author.toLowerCase();
      const send = isOwner && !isMine
        ? () => (writeContract as any).adminUpdatePostURI(tokenIdBig, tokenUri)
        : () => (writeContract as any).updatePostURI(tokenIdBig, tokenUri);

      await runContractTx("Edit post", send);
      cancelEditPost();
      await feed.refreshFeed();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }, [walletAddress, isOwner, editingTokenId, isEditImageLoading, editDraft, getWriteContract, ipfsConfigured, editUploadedImageBlob, editUploadedImageFilename, runContractTx, cancelEditPost, feed, setStatus]);

  const burnPost = useCallback(async (tokenId: string) => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      const writeContract = await getWriteContract();
      const tokenIdBig = BigInt(tokenId);
      const post = feed.posts.find((p) => p.tokenId === tokenId);
      const author = post?.author;
      const isMine = !!author && walletAddress.toLowerCase() === author.toLowerCase();
      const send = isOwner && !isMine
        ? () => (writeContract as any).adminBurnPost(tokenIdBig)
        : () => (writeContract as any).burnPost(tokenIdBig);

      await runContractTx("Burn post", send);

      if (editingTokenId === tokenId) {
        cancelEditPost();
      }

      feed.setPosts((prev) => prev.filter((p) => p.tokenId !== tokenId));
      feed.setPostComments((prev) => {
        if (!(tokenId in prev)) return prev;
        const { [tokenId]: _, ...rest } = prev;
        return rest;
      });
      setTipDrafts((prev) => {
        if (!(tokenId in prev)) return prev;
        const { [tokenId]: _, ...rest } = prev;
        return rest;
      });
      setCommentDrafts((prev) => {
        if (!(tokenId in prev)) return prev;
        const { [tokenId]: _, ...rest } = prev;
        return rest;
      });

      await feed.refreshFeed();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }, [walletAddress, isOwner, getWriteContract, runContractTx, editingTokenId, cancelEditPost, feed, setStatus]);

  const handleTip = useCallback(async (tokenId: string) => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      const raw = (tipDrafts[tokenId] ?? "").trim();
      const amount = raw.length ? Number(raw) : 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus("Enter a valid tip amount.");
        return;
      }

      const valueWei = ethers.parseEther(raw);
      const writeContract = await getWriteContract();
      const tokenIdBig = BigInt(tokenId);

      await runContractTx("Tip", () => writeContract.tipPost(tokenIdBig, { value: valueWei }));

      feed.setPosts((prev) => prev.map((p) => (p.tokenId === tokenId ? { ...p, tipsWei: p.tipsWei + valueWei } : p)));
      setTipDrafts((prev) => ({ ...prev, [tokenId]: "" }));
      void refreshWalletPanel();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }, [walletAddress, tipDrafts, getWriteContract, runContractTx, feed, refreshWalletPanel, setStatus]);

  const withdrawTips = useCallback(async () => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      const writeContract = await getWriteContract();
      await runContractTx("Withdraw tips", () => writeContract.withdrawTips());
      void refreshWalletPanel();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }, [walletAddress, getWriteContract, runContractTx, refreshWalletPanel, setStatus]);

  const handleAction = useCallback(
    async (tokenId: string, action: "like" | "comment" | "share") => {
      try {
        if (!walletAddress) {
          setStatus("Connect your wallet first.");
          return;
        }

        const writeContract = await getWriteContract();
        const tokenIdBig = BigInt(tokenId);

        if (action === "comment") {
          const comment = commentDrafts[tokenId];
          if (!comment) {
            setStatus("Write a comment before signing.");
            return;
          }
          const ok = await runContractTx<boolean>("Comment", () => writeContract.commentPost(tokenIdBig, comment), () => true);
          if (!ok) return;

          feed.setPosts((prev) => prev.map((post) => (post.tokenId === tokenId ? { ...post, comments: post.comments + 1 } : post)));
          setCommentDrafts((prev) => ({ ...prev, [tokenId]: "" }));
          void feed.loadCommentsForPost(tokenId);
          return;
        }

        if (action === "like") {
          const already = (await (writeContract as any).hasLiked(tokenIdBig, walletAddress)) as boolean;
          const ok = await runContractTx<boolean>(
            already ? "Unlike" : "Like",
            () => ((already ? (writeContract as any).unlikePost(tokenIdBig) : writeContract.likePost(tokenIdBig)) as any),
            () => true
          );
          if (!ok) return;

          feed.setPosts((prev) =>
            prev.map((post) => {
              if (post.tokenId !== tokenId) return post;
              const next = already ? Math.max(0, post.likes - 1) : post.likes + 1;
              return { ...post, likes: next, likedByMe: !already };
            })
          );
          return;
        }

        if (action === "share") {
          const already = (await (writeContract as any).hasShared(tokenIdBig, walletAddress)) as boolean;
          const ok = await runContractTx<boolean>(
            already ? "Unsave" : "Save",
            () => ((already ? (writeContract as any).unsharePost(tokenIdBig) : (writeContract as any).sharePost(tokenIdBig)) as any),
            () => true
          );
          if (!ok) return;

          feed.setPosts((prev) =>
            prev.map((post) => {
              if (post.tokenId !== tokenId) return post;
              const next = already ? Math.max(0, post.shares - 1) : post.shares + 1;
              return { ...post, shares: next, repostedByMe: !already };
            })
          );
          return;
        }
      } catch (error) {
        setStatus(getErrorMessage(error));
      }
    },
    [walletAddress, getWriteContract, runContractTx, commentDrafts, feed, setStatus]
  );

  const value = useMemo<SocialActionsContextValue>(
    () => ({
      isOwner,
      editingTokenId,
      editDraft,
      isEditImageLoading,
      tipDrafts,
      commentDrafts,
      setEditDraft,
      onTipDraftChange,
      onCommentDraftChange,
      onEditSelectFile,
      onEditClearImage,
      startEditPost,
      cancelEditPost,
      saveEditedPost,
      burnPost,
      freezePost,
      handleAction,
      handleTip,
      withdrawTips
    }),
    [
      isOwner,
      editingTokenId,
      editDraft,
      isEditImageLoading,
      tipDrafts,
      commentDrafts,
      onTipDraftChange,
      onCommentDraftChange,
      onEditSelectFile,
      onEditClearImage,
      startEditPost,
      cancelEditPost,
      saveEditedPost,
      burnPost,
      freezePost,
      handleAction,
      handleTip,
      withdrawTips
    ]
  );

  return <SocialActionsContext.Provider value={value}>{children}</SocialActionsContext.Provider>;
}

export function useSocialActions() {
  const ctx = useContext(SocialActionsContext);
  if (!ctx) throw new Error("useSocialActions must be used within <SocialActionsProvider>");
  return ctx;
}
