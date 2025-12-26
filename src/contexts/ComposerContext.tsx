import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { hasPinata, ipfsToHttp } from "../ipfs";
import type { Draft, Post } from "../types";
import { socialInterface } from "../contracts/socialPosts";
import { createMetadataUri, fetchTokenMetadata } from "../lib/metadata";
import { getErrorMessage } from "../lib/errors";
import { buildIpfsTokenUri } from "../lib/ipfsTokenUri";
import { useContract } from "./ContractContext";
import { useFeed } from "./FeedContext";
import { useStatus } from "./StatusContext";
import { useTxNotifications } from "./TxNotificationsContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";

export type ComposerContextValue = {
  isComposerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;

  ipfsConfigured: boolean;

  draft: Draft;
  isImageLoading: boolean;
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

  const getWriteContract = contract.getWriteContract;

  const [draft, setDraft] = useState<Draft>({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [uploadedImageBlob, setUploadedImageBlob] = useState<Blob | null>(null);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<string>("");
  const composerPreviewObjectUrlRef = useRef<string | null>(null);

  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    if (!approvalRequested) return;

    let cancelled = false;
    const t = window.setInterval(() => {
      void (async () => {
        try {
          const readContract = await contract.getReadContract();
          const allowed = (await (readContract as any).isPosterAllowed(walletAddress)) as boolean;
          if (!allowed) return;
          if (cancelled) return;
          setApprovalRequired(false);
          setApprovalRequested(false);
          setStatus("You’ve been approved. You can post now.");
        } catch {
          // ignore
        }
      })();
    }, 3500);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [walletAddress, approvalRequested, contract, setStatus]);

  const ipfsConfigured = useMemo(() => hasPinata(), []);

  const openComposer = useCallback(() => setIsComposerOpen(true), []);
  const closeComposer = useCallback(() => setIsComposerOpen(false), []);

  const dismissApproval = useCallback(() => {
    setApprovalRequired(false);
    setApprovalRequested(false);
  }, []);

  const requestApproval = useCallback(async () => {
    if (!walletAddress) {
      setStatus("Connect your wallet first.");
      return;
    }

    if (approvalRequested) {
      setStatus("Approval already requested. Please wait for an admin to approve your wallet.");
      return;
    }

    try {
      await runContractTx("Request posting approval", async () => {
        const writeContract = await contract.getWriteContract();
        return (writeContract as any).requestPosterApproval();
      });
    } catch {
      return;
    }

    // Success: keep the modal open so the user sees confirmation,
    // but keep polling until approved.
    setApprovalRequired(true);
    setApprovalRequested(true);
    setStatus("Approval requested. An admin must approve your wallet before you can post.");
  }, [walletAddress, approvalRequested, runContractTx, contract, setStatus]);

  const handleDraftChange = useCallback((field: keyof Draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const onComposerImageUrlChange = useCallback((value: string) => {
    if (composerPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(composerPreviewObjectUrlRef.current);
      composerPreviewObjectUrlRef.current = null;
    }
    setDraft((prev) => ({ ...prev, imageUrl: value, imageDataUrl: "" }));
    if (value) {
      setUploadedImageBlob(null);
      setUploadedImageFilename("");
    }
  }, []);

  const onComposerClearImage = useCallback(() => {
    setDraft((prev) => ({ ...prev, imageDataUrl: "" }));
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
    if (composerPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(composerPreviewObjectUrlRef.current);
      composerPreviewObjectUrlRef.current = null;
    }
  }, []);

  const onSelectComposerFile = useCallback(
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

        setIsImageLoading(true);
        setStatus(isVideo ? "Preparing uploaded video..." : "Processing uploaded image...");

        if (composerPreviewObjectUrlRef.current) {
          URL.revokeObjectURL(composerPreviewObjectUrlRef.current);
          composerPreviewObjectUrlRef.current = null;
        }

        if (isVideo) {
          const objectUrl = URL.createObjectURL(file);
          composerPreviewObjectUrlRef.current = objectUrl;
          setDraft((prev) => ({ ...prev, imageDataUrl: objectUrl, imageUrl: "" }));
          setUploadedImageBlob(file);
          setUploadedImageFilename(file.name || "post-video");
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
          setStatus(
            "Uploaded image is too large to embed on-chain. Use a smaller image, or paste an image URL (recommended: IPFS/http)."
          );
          return;
        }

        const blobRes = await fetch(best);
        const blob = await blobRes.blob();

        setDraft((prev) => ({ ...prev, imageDataUrl: best!, imageUrl: "" }));
        setUploadedImageBlob(blob);
        setUploadedImageFilename(file.name || "post-image.jpg");
        setStatus("Uploaded image ready.");
      } catch {
        setStatus("Failed to read image.");
      } finally {
        setIsImageLoading(false);
      }
    },
    [ipfsConfigured, setStatus]
  );

  const mintPost = useCallback(async () => {
    const normalizeChainId = (id: string | null): string | null => {
      if (!id) return null;
      if (id.startsWith("0x") || id.startsWith("0X")) {
        const n = Number.parseInt(id, 16);
        return Number.isFinite(n) ? String(n) : null;
      }
      const n = Number.parseInt(id, 10);
      return Number.isFinite(n) ? String(n) : null;
    };

    const makeLocalNoticeId = () => `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

    const waitForUrlReachable = async (url: string, attempts = 10, delayMs = 750) => {
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

    const waitForMetadataReady = async (tokenUri: string, attempts = 10, delayMs = 750) => {
      for (let i = 0; i < attempts; i++) {
        const meta = await fetchTokenMetadata(tokenUri);
        const hasAny =
          typeof meta.name === "string" ||
          typeof meta.description === "string" ||
          typeof meta.image === "string" ||
          typeof meta.animation_url === "string";
        if (hasAny) return meta;
        await sleep(delayMs);
      }
      return fetchTokenMetadata(tokenUri);
    };

    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      try {
        const readContract = await contract.getReadContract();
        const allowed = (await (readContract as any).isPosterAllowed(walletAddress)) as boolean;
        if (!allowed) {
          const requested = (await (readContract as any).hasPosterRequested(walletAddress)) as boolean;
          setApprovalRequired(true);
          setApprovalRequested(Boolean(requested));
          setIsComposerOpen(false);
          setStatus(
            requested
              ? "Posting is in closed beta. Approval requested — wait for an admin to approve your wallet."
              : "Posting is in closed beta. Request approval to post."
          );
          return;
        }

        setApprovalRequired(false);
        setApprovalRequested(false);
      } catch {
        // If the pre-check fails, let the mint attempt proceed and surface the revert.
      }
      if (isImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        return;
      }
      if (!draft.body || (!draft.imageUrl && !draft.imageDataUrl)) {
        setStatus("Fill out the post text and add an image URL or upload an image.");
        return;
      }

      const writeContract = await getWriteContract();

      const processingToastId = ipfsConfigured ? makeLocalNoticeId() : null;
      if (processingToastId) {
        txNotifications.notifyPending({ hash: processingToastId, label: "Preparing post…", explorerUrl: null });
      }

      let metadataURI = "";
      let imageRefForUi = draft.imageDataUrl || draft.imageUrl;
      let animationUrlForUi: string | undefined;

      if (ipfsConfigured) {
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
        () => writeContract.mintPost(metadataURI),
        async (receipt) => {
          let mintedTokenId: string | null = null;
          let mintedAuthor: string | undefined;
          let mintTxHash: string | undefined;

          mintTxHash = receipt.hash;

          for (const log of receipt.logs) {
            try {
              const parsed = socialInterface.parseLog({ topics: log.topics as string[], data: log.data });
              if (parsed?.name === "PostMinted") {
                mintedAuthor = parsed.args[0] as string;
                mintedTokenId = (parsed.args[1] as bigint).toString();
                break;
              }
            } catch {
              // not our event
            }
          }

          return { mintedTokenId, mintedAuthor, mintTxHash };
        }
      );

      if (!minted?.mintedTokenId) {
        setStatus("Mint confirmed, but tokenId could not be parsed. Reloading feed...");
        await feed.refreshFeed();
        if (processingToastId) txNotifications.dismiss(processingToastId);
        return;
      }

      const newPost: Post = {
        tokenId: minted.mintedTokenId,
        chainId: normalizeChainId(chainId) ?? undefined,
        title: draft.title,
        body: draft.body,
        image: imageRefForUi,
        animationUrl: animationUrlForUi,
        metadataURI,
        author: minted.mintedAuthor,
        mintTxHash: minted.mintTxHash,
        likes: 0,
        comments: 0,
        shares: 0,
        tipsWei: 0n
      };

      setDraft({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
      setUploadedImageBlob(null);
      setUploadedImageFilename("");
      if (composerPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(composerPreviewObjectUrlRef.current);
        composerPreviewObjectUrlRef.current = null;
      }
      setIsComposerOpen(false);

      if (processingToastId && metadataURI.startsWith("ipfs://")) {
        txNotifications.notifyPending({ hash: processingToastId, label: "Post created — finalizing media…", explorerUrl: null });

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
    }
  }, [walletAddress, chainId, contract, isImageLoading, draft, getWriteContract, ipfsConfigured, uploadedImageBlob, uploadedImageFilename, feed, runContractTx, setStatus, txNotifications]);

  const value = useMemo<ComposerContextValue>(
    () => ({
      isComposerOpen,
      openComposer,
      closeComposer,
      ipfsConfigured,
      draft,
      isImageLoading,
      handleDraftChange,
      onComposerImageUrlChange,
      onComposerClearImage,
      onSelectComposerFile,
      mintPost,
      approvalRequired,
      approvalRequested,
      requestApproval,
      dismissApproval
    }),
    [
      isComposerOpen,
      openComposer,
      closeComposer,
      ipfsConfigured,
      draft,
      isImageLoading,
      handleDraftChange,
      onComposerImageUrlChange,
      onComposerClearImage,
      onSelectComposerFile,
      mintPost,
      approvalRequired,
      approvalRequested,
      requestApproval,
      dismissApproval
    ]
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error("useComposer must be used within <ComposerProvider>");
  return ctx;
}
