import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Draft } from "@types";
import {
  IMAGE_COMPRESSION_CANDIDATES,
  IMAGE_COMPRESSION_CANDIDATES_IPFS,
  MAX_IMAGE_DATA_URL_CHARS,
  MAX_IMAGE_DATA_URL_CHARS_IPFS
} from "@features/post/services/draftConstants";
import { useVideoTrim } from "@features/videoTrim";
import type { VideoTrimResult } from "@features/videoTrim/types";

export function useComposerMedia(params: {
  ipfsConfigured: boolean;
  setStatus: (s: string) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const { ipfsConfigured, setStatus, setDraft } = params;
  const videoTrim = useVideoTrim();

  const [isImageLoading, setIsImageLoading] = useState(false);
  const [uploadedImageBlob, setUploadedImageBlob] = useState<Blob | null>(null);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<string>("");
  const composerPreviewObjectUrlRef = useRef<string | null>(null);
  const composerPosterObjectUrlRef = useRef<string | null>(null);

  const revokePreviewObjectUrl = useCallback(() => {
    if (composerPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(composerPreviewObjectUrlRef.current);
      composerPreviewObjectUrlRef.current = null;
    }
  }, []);

  const revokePosterObjectUrl = useCallback(() => {
    if (composerPosterObjectUrlRef.current) {
      URL.revokeObjectURL(composerPosterObjectUrlRef.current);
      composerPosterObjectUrlRef.current = null;
    }
  }, []);

  const handleTrimSuccess = useCallback(
    (result: VideoTrimResult) => {
      revokePreviewObjectUrl();
      revokePosterObjectUrl();
      const objectUrl = URL.createObjectURL(result.trimmedFile);
      const posterUrl = URL.createObjectURL(result.thumbnailBlob);
      composerPreviewObjectUrlRef.current = objectUrl;
      composerPosterObjectUrlRef.current = posterUrl;
      setDraft((prev) => ({
        ...prev,
        imageDataUrl: objectUrl,
        imageUrl: "",
        videoTrim: {
          startMs: result.startMs,
          endMs: result.endMs,
          durationMs: result.durationMs
        },
        videoPosterUrl: posterUrl
      }));
      setUploadedImageBlob(result.trimmedFile);
      setUploadedImageFilename(result.trimmedFile.name);
      setIsImageLoading(false);
      setStatus("Trimmed video ready.");
    },
    [revokePreviewObjectUrl, revokePosterObjectUrl, setDraft, setIsImageLoading, setStatus]
  );

  const handleTrimCancel = useCallback(() => {
    setIsImageLoading(false);
    setStatus("Video trimming cancelled.");
  }, [setStatus]);

  const onComposerImageUrlChange = useCallback(
    (value: string) => {
      revokePreviewObjectUrl();
      revokePosterObjectUrl();
      setDraft((prev) => ({ ...prev, imageUrl: value, imageDataUrl: "", videoTrim: undefined, videoPosterUrl: undefined }));
      if (value) {
        setUploadedImageBlob(null);
        setUploadedImageFilename("");
      }
    },
    [revokePreviewObjectUrl, revokePosterObjectUrl, setDraft]
  );

  const onComposerClearImage = useCallback(() => {
    setDraft((prev) => ({ ...prev, imageDataUrl: "", videoTrim: undefined, videoPosterUrl: undefined }));
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
    revokePreviewObjectUrl();
    revokePosterObjectUrl();
  }, [revokePreviewObjectUrl, revokePosterObjectUrl, setDraft]);

  const resetMedia = useCallback(() => {
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
    revokePreviewObjectUrl();
    revokePosterObjectUrl();
    setDraft((prev) => ({ ...prev, videoTrim: undefined, videoPosterUrl: undefined }));
  }, [revokePreviewObjectUrl, revokePosterObjectUrl, setDraft]);

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

        revokePreviewObjectUrl();
        revokePosterObjectUrl();

        if (isVideo) {
          setIsImageLoading(true);
          setStatus("Preparing uploaded video...");
          videoTrim.openVideoTrim({
            originalFile: file,
            onConfirm: handleTrimSuccess,
            onCancel: handleTrimCancel
          });
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
            ctx.imageSmoothingEnabled = true;
            (ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);

            return canvas.toDataURL("image/jpeg", quality);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        };

        const maxDataUrlChars = ipfsConfigured ? MAX_IMAGE_DATA_URL_CHARS_IPFS : MAX_IMAGE_DATA_URL_CHARS;
        const candidates = ipfsConfigured ? IMAGE_COMPRESSION_CANDIDATES_IPFS : IMAGE_COMPRESSION_CANDIDATES;
        let best: string | null = null;
        for (const c of candidates) {
          const attempt = await compressToJpegDataUrl(file, c.q, c.dim);
          best = attempt;
          if (attempt.length <= maxDataUrlChars) break;
        }

        if (!best || best.length > maxDataUrlChars) {
          setStatus(ipfsConfigured ? "Uploaded image is too large. Try a smaller image." : "Uploaded image is too large to embed on-chain. Use a smaller image, or paste an image URL (recommended: IPFS/http)." );
          return;
        }

        const blobRes = await fetch(best);
        const blob = await blobRes.blob();

        setDraft((prev) => ({ ...prev, imageDataUrl: best!, imageUrl: "", videoTrim: undefined, videoPosterUrl: undefined }));
        setUploadedImageBlob(blob);
        setUploadedImageFilename(file.name || "post-image.jpg");
        setStatus("Uploaded image ready.");
      } catch {
        setStatus("Failed to read image.");
      } finally {
        setIsImageLoading(false);
      }
    },
    [ipfsConfigured, revokePreviewObjectUrl, setDraft, setStatus, videoTrim, handleTrimSuccess, handleTrimCancel]
  );

  useEffect(() => {
    return () => {
      revokePreviewObjectUrl();
      revokePosterObjectUrl();
    };
  }, [revokePreviewObjectUrl, revokePosterObjectUrl]);

  return useMemo(
    () => ({
      isImageLoading,
      uploadedImageBlob,
      uploadedImageFilename,
      onSelectComposerFile,
      onComposerImageUrlChange,
      onComposerClearImage,
      resetMedia
    }),
    [
      isImageLoading,
      uploadedImageBlob,
      uploadedImageFilename,
      onSelectComposerFile,
      onComposerImageUrlChange,
      onComposerClearImage,
      resetMedia
    ]
  );
}
