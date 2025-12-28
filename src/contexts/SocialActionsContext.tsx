import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import type { Draft, Post } from "../types";
import { createMetadataUri } from "../lib/metadata";
import { getErrorMessage } from "../lib/errors";
import { extractIpfsCid, hasPinata, ipfsToHttp, pinataUnpinCid } from "../ipfs";
import { buildIpfsTokenUri } from "../lib/ipfsTokenUri";
import { getNetworkBadgeLabel } from "../lib/chain";
import { useContract } from "./ContractContext";
import { useFeed } from "./FeedContext";
import { useStatus } from "./StatusContext";
import { useTxNotifications } from "./TxNotificationsContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";
import { fetchTokenMetadata } from "../lib/metadata";

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

  burnPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
  freezePost: (tokenId: string, postChainId?: string | null) => Promise<void>;

  handleAction: (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null) => Promise<boolean>;
  handleTip: (tokenId: string, postChainId?: string | null) => Promise<boolean>;

  withdrawTips: () => Promise<void>;
};

const SocialActionsContext = createContext<SocialActionsContextValue | null>(null);

export function SocialActionsProvider({ children }: { children: React.ReactNode }) {
  const { walletAddress, chainId, refreshWalletPanel } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();
  const feed = useFeed();
  const txNotifications = useTxNotifications();
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

  const ensureMatchingNetwork = useCallback(
    (postChainId?: string | null) => {
      if (!postChainId) return true;
      if (!chainId) return true;
      if (postChainId === chainId) return true;

      setStatus(
        `Wrong network. Switch to ${getNetworkBadgeLabel(postChainId)} to interact with this post.`
      );
      return false;
    },
    [chainId, setStatus]
  );

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
        setEditDraft({ title: post.title, body: post.body, imageUrl: post.animationUrl ?? post.image, imageDataUrl: "" });
        setEditUploadedImageBlob(null);
        setEditUploadedImageFilename("");
      })();
    },
    [getReadContract, isOwner, setStatus]
  );

  const collectIpfsCidsFromTokenUri = useCallback(async (tokenUri: string): Promise<Set<string>> => {
    const out = new Set<string>();
    const metaCid = extractIpfsCid(tokenUri);
    if (metaCid) out.add(metaCid);

    const meta = await fetchTokenMetadata(tokenUri);
    const imageCid = extractIpfsCid(String(meta?.image ?? ""));
    if (imageCid) out.add(imageCid);
    const animCid = extractIpfsCid(String((meta as any)?.animation_url ?? ""));
    if (animCid) out.add(animCid);
    return out;
  }, []);

  const bestEffortUnpinCids = useCallback(
    async (cids: Iterable<string>) => {
      if (!ipfsConfigured) return;
      const unique = Array.from(new Set(Array.from(cids).map((c) => String(c).trim()).filter(Boolean)));
      if (!unique.length) return;
      await Promise.allSettled(unique.map((cid) => pinataUnpinCid(cid)));
    },
    [ipfsConfigured]
  );

  const collectReferencedIpfsCidsFromFeed = useCallback(
    (exclude?: { chainId?: string | null; tokenId?: string | null }) => {
      const out = new Set<string>();
      const excludeChain = exclude?.chainId ? String(exclude.chainId).trim() : "";
      const excludeToken = exclude?.tokenId ? String(exclude.tokenId).trim() : "";

      for (const p of feed.posts) {
        if (excludeChain && excludeToken) {
          if (String(p.chainId ?? "").trim() === excludeChain && String(p.tokenId ?? "").trim() === excludeToken) {
            continue;
          }
        }

        const refs = [p.metadataURI, p.image, p.animationUrl].filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0
        );
        for (const ref of refs) {
          const cid = extractIpfsCid(ref);
          if (cid) out.add(cid);
        }
      }

      return out;
    },
    [feed.posts]
  );

  const cancelEditPost = useCallback(() => {
    setEditingTokenId(null);
    setEditDraft({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
    setIsEditImageLoading(false);
  }, []);

  const freezePost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      try {
        if (!walletAddress) {
          setStatus("Connect your wallet first.");
          return;
        }
        if (!ensureMatchingNetwork(postChainId)) return;

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
    [walletAddress, ensureMatchingNetwork, getWriteContract, runContractTx, cancelEditPost, setStatus]
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
        const maxTokenUriChars = 140_000;
        const candidates = [
          { q: 0.78, dim: 640 },
          { q: 0.7, dim: 512 },
          { q: 0.62, dim: 512 },
          { q: 0.55, dim: 420 }
        ];
        let best: string | null = null;
        for (const c of candidates) {
          const attempt = await compressToJpegDataUrl(file, c.q, c.dim);
          if (attempt.length > maxDataUrlChars) {
            best = attempt;
            continue;
          }

          // If we are falling back to on-chain data URIs, ensure the final metadata URI fits too.
          if (!ipfsConfigured) {
            const tokenUriAttempt = createMetadataUri({
              ...editDraft,
              imageUrl: "",
              imageDataUrl: attempt
            });
            if (tokenUriAttempt.length > maxTokenUriChars) {
              best = attempt;
              continue;
            }
          }

          best = attempt;
          break;
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

      const makeLocalNoticeId = () => `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
        newPinnedCids = new Set<string>();
        const metaCid = extractIpfsCid(built.tokenUri);
        if (metaCid) newPinnedCids.add(metaCid);
        const imageCid = extractIpfsCid(built.imageRef);
        if (imageCid) newPinnedCids.add(imageCid);
        const animCid = extractIpfsCid(built.animationRef);
        if (animCid) newPinnedCids.add(animCid);
      } else {
        tokenUri = createMetadataUri(editDraft);
        nextUiImage = imageDataUrlTrimmed || imageUrlTrimmed;
        nextUiAnimationUrl = undefined;
        const maxTokenUriChars = 140_000;
        if (tokenUri.length > maxTokenUriChars) {
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
      const send = isOwner && !isMine
        ? () => (writeContract as any).adminUpdatePostURI(tokenIdBig, tokenUri)
        : () => (writeContract as any).updatePostURI(tokenIdBig, tokenUri);

      await runContractTx("Edit post", send);

      // If this is an IPFS-backed edit, show a short "finalizing" state like mint does.
      // This reduces confusion when gateways take a moment to serve the new metadata/media.
      const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
      const waitForUrlReachable = async (url: string, attempts = 10, delayMs = 650) => {
        for (let i = 0; i < attempts; i++) {
          try {
            const controller = new AbortController();
            const t = window.setTimeout(() => controller.abort(), 2500);
            try {
              const head = await fetch(url, { method: "HEAD", signal: controller.signal, cache: "no-store" });
              if (head.ok) return true;
            } catch {
              // fall through
            } finally {
              window.clearTimeout(t);
            }

            const controller2 = new AbortController();
            const t2 = window.setTimeout(() => controller2.abort(), 2500);
            try {
              const probe = await fetch(url, {
                method: "GET",
                headers: { Range: "bytes=0-0" },
                signal: controller2.signal,
                cache: "no-store"
              });
              if (probe.ok) return true;
            } catch {
              // ignore
            } finally {
              window.clearTimeout(t2);
            }
          } catch {
            // ignore
          }

          await sleep(delayMs);
        }
        return false;
      };

      const waitForMetadataReady = async (tokenUriToCheck: string, attempts = 10, delayMs = 650) => {
        for (let i = 0; i < attempts; i++) {
          const meta = await fetchTokenMetadata(tokenUriToCheck);
          const hasAny =
            typeof meta.name === "string" ||
            typeof meta.description === "string" ||
            typeof meta.image === "string" ||
            typeof meta.animation_url === "string";
          if (hasAny) return meta;
          await sleep(delayMs);
        }
        return fetchTokenMetadata(tokenUriToCheck);
      };

      if (willUseIpfs && tokenUri.startsWith("ipfs://")) {
        const finalizingToastId = makeLocalNoticeId();
        txNotifications.notifyPending({
          hash: finalizingToastId,
          label: "Post updated — finalizing media…",
          explorerUrl: null
        });

        try {
          await waitForUrlReachable(ipfsToHttp(tokenUri), 10, 650);
          const meta = await waitForMetadataReady(tokenUri, 10, 650);

          const mediaRef =
            (typeof meta.animation_url === "string" && meta.animation_url.trim()) ||
            (typeof meta.image === "string" && meta.image.trim()) ||
            "";

          if (mediaRef && mediaRef.startsWith("ipfs://")) {
            await waitForUrlReachable(ipfsToHttp(mediaRef), 12, 650);
          }
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
        const referenced = collectReferencedIpfsCidsFromFeed({ chainId, tokenId: editingTokenId });
        const safeToUnpin = toRemove.filter((cid) => !referenced.has(cid));
        void bestEffortUnpinCids(safeToUnpin);
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
  }, [walletAddress, isOwner, editingTokenId, isEditImageLoading, editDraft, getReadContract, getWriteContract, ipfsConfigured, editUploadedImageBlob, editUploadedImageFilename, runContractTx, cancelEditPost, feed, setStatus, txNotifications, collectIpfsCidsFromTokenUri, bestEffortUnpinCids, collectReferencedIpfsCidsFromFeed, chainId]);

  const burnPost = useCallback(async (tokenId: string, postChainId?: string | null) => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }
      if (!ensureMatchingNetwork(postChainId)) return;

      // Capture tokenURI + related IPFS CIDs before burn.
      let pinnedCids: Set<string> | null = null;
      try {
        if (ipfsConfigured) {
          const readContract = await getReadContract();
          const tokenIdBig = BigInt(tokenId);
          const oldTokenUri = (await (readContract as any).tokenURI(tokenIdBig)) as string;
          pinnedCids = await collectIpfsCidsFromTokenUri(oldTokenUri);
        }
      } catch {
        pinnedCids = null;
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

      // Best-effort cleanup: stop pinning the burned post's metadata/media.
      if (ipfsConfigured && pinnedCids) {
        const referenced = collectReferencedIpfsCidsFromFeed({ chainId: postChainId ?? chainId, tokenId });
        const safeToUnpin = Array.from(pinnedCids).filter((cid) => !referenced.has(cid));
        void bestEffortUnpinCids(safeToUnpin);
      }

      if (editingTokenId === tokenId) {
        cancelEditPost();
      }

      feed.setPosts((prev) =>
        prev.filter((p) => {
          if (p.tokenId !== tokenId) return true;
          if (postChainId && p.chainId && p.chainId !== postChainId) return true;
          return false;
        })
      );
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
  }, [walletAddress, ensureMatchingNetwork, ipfsConfigured, getReadContract, getWriteContract, isOwner, runContractTx, editingTokenId, cancelEditPost, feed, setStatus, collectIpfsCidsFromTokenUri, bestEffortUnpinCids, collectReferencedIpfsCidsFromFeed, chainId]);

  const handleTip = useCallback(async (tokenId: string, postChainId?: string | null) => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return false;
      }
      if (!ensureMatchingNetwork(postChainId)) return false;

      const raw = (tipDrafts[tokenId] ?? "").trim();
      const amount = raw.length ? Number(raw) : 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus("Enter a valid tip amount.");
        return false;
      }

      const valueWei = ethers.parseEther(raw);
      const writeContract = await getWriteContract();
      const tokenIdBig = BigInt(tokenId);

      const ok = await runContractTx<boolean>(
        "Tip",
        () => writeContract.tipPost(tokenIdBig, { value: valueWei }),
        () => true
      );
      if (!ok) return false;

      feed.setPosts((prev) =>
        prev.map((p) => {
          if (p.tokenId !== tokenId) return p;
          if (postChainId && p.chainId && p.chainId !== postChainId) return p;
          return { ...p, tipsWei: p.tipsWei + valueWei };
        })
      );
      setTipDrafts((prev) => ({ ...prev, [tokenId]: "" }));
      void refreshWalletPanel();
      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    }
  }, [walletAddress, ensureMatchingNetwork, tipDrafts, getWriteContract, runContractTx, feed, refreshWalletPanel, setStatus]);

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
    async (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null) => {
      try {
        if (!walletAddress) {
          setStatus("Connect your wallet first.");
          return false;
        }
        if (!ensureMatchingNetwork(postChainId)) return false;

        const writeContract = await getWriteContract();
        const tokenIdBig = BigInt(tokenId);

        if (action === "comment") {
          const comment = commentDrafts[tokenId];
          if (!comment) {
            setStatus("Write a comment before signing.");
            return false;
          }
          const ok = await runContractTx<boolean>("Comment", () => writeContract.commentPost(tokenIdBig, comment), () => true);
          if (!ok) return false;

          feed.setPosts((prev) =>
            prev.map((post) => {
              if (post.tokenId !== tokenId) return post;
              if (postChainId && post.chainId && post.chainId !== postChainId) return post;
              return { ...post, comments: post.comments + 1 };
            })
          );
          setCommentDrafts((prev) => ({ ...prev, [tokenId]: "" }));
          void feed.loadCommentsForPost(tokenId);
          return true;
        }

        if (action === "like") {
          const already = (await (writeContract as any).hasLiked(tokenIdBig, walletAddress)) as boolean;
          const ok = await runContractTx<boolean>(
            already ? "Unlike" : "Like",
            () => ((already ? (writeContract as any).unlikePost(tokenIdBig) : writeContract.likePost(tokenIdBig)) as any),
            () => true
          );
          if (!ok) return false;

          feed.setPosts((prev) =>
            prev.map((post) => {
              if (post.tokenId !== tokenId) return post;
              if (postChainId && post.chainId && post.chainId !== postChainId) return post;
              const next = already ? Math.max(0, post.likes - 1) : post.likes + 1;
              return { ...post, likes: next, likedByMe: !already };
            })
          );
          return true;
        }

        if (action === "save") {
          const already = (await (writeContract as any).hasSaved(tokenIdBig, walletAddress)) as boolean;
          const ok = await runContractTx<boolean>(
            already ? "Unsave" : "Save",
            () => ((already ? (writeContract as any).unsavePost(tokenIdBig) : (writeContract as any).savePost(tokenIdBig)) as any),
            () => true
          );
          if (!ok) return false;

          feed.setPosts((prev) =>
            prev.map((post) => {
              if (post.tokenId !== tokenId) return post;
              if (postChainId && post.chainId && post.chainId !== postChainId) return post;
              const next = already ? Math.max(0, post.saves - 1) : post.saves + 1;
              return { ...post, saves: next, savedByMe: !already };
            })
          );
          return true;
        }

        return false;
      } catch (error) {
        setStatus(getErrorMessage(error));
        return false;
      }
    },
    [walletAddress, ensureMatchingNetwork, getWriteContract, runContractTx, commentDrafts, feed, setStatus]
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
