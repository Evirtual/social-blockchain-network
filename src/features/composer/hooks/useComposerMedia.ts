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
import { useImageCrop } from "@features/imageCrop";
import type { ImageCropRect } from "@features/imageCrop";
import { clearObjectUrlRef, replaceObjectUrlRef } from "@shared/lib/objectUrl";

const compressToJpegDataUrl = async (blob: Blob, quality: number, maxDim: number, crop?: ImageCropRect) => {
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

    const naturalWidth = Math.max(1, img.width);
    const naturalHeight = Math.max(1, img.height);
    const safeCrop = crop
      ? {
          left: Math.min(Math.max(crop.left, 0), 1),
          top: Math.min(Math.max(crop.top, 0), 1),
          right: Math.min(Math.max(crop.right, 0), 1),
          bottom: Math.min(Math.max(crop.bottom, 0), 1)
        }
      : null;

    const left = safeCrop ? Math.min(safeCrop.left, safeCrop.right) : 0;
    const right = safeCrop ? Math.max(safeCrop.left, safeCrop.right) : 1;
    const top = safeCrop ? Math.min(safeCrop.top, safeCrop.bottom) : 0;
    const bottom = safeCrop ? Math.max(safeCrop.top, safeCrop.bottom) : 1;

    const sx = Math.round(left * naturalWidth);
    const sy = Math.round(top * naturalHeight);
    const sw = Math.max(1, Math.round((right - left) * naturalWidth));
    const sh = Math.max(1, Math.round((bottom - top) * naturalHeight));

    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.imageSmoothingEnabled = true;
    (ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export function useComposerMedia(params: {
  ipfsConfigured: boolean;
  setStatus: (s: string) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const { ipfsConfigured, setStatus, setDraft } = params;
  const videoTrim = useVideoTrim();
  const imageCrop = useImageCrop();

  const [isImageLoading, setIsImageLoading] = useState(false);
  const [uploadedImageBlob, setUploadedImageBlob] = useState<Blob | null>(null);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<string>("");
  const composerPreviewObjectUrlRef = useRef<string | null>(null);
  const composerPosterObjectUrlRef = useRef<string | null>(null);

  const handleTrimSuccess = useCallback(
    (result: VideoTrimResult) => {
      const objectUrl = replaceObjectUrlRef(composerPreviewObjectUrlRef, result.trimmedFile);
      const posterUrl = replaceObjectUrlRef(composerPosterObjectUrlRef, result.thumbnailBlob);
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
    [setDraft, setIsImageLoading, setStatus]
  );

  const handleTrimCancel = useCallback(() => {
    setIsImageLoading(false);
    setStatus("Video trimming cancelled.");
  }, [setStatus]);

  const handleCropCancel = useCallback(() => {
    setIsImageLoading(false);
    setStatus("Image cropping cancelled.");
  }, [setStatus]);

  const onComposerImageUrlChange = useCallback(
    (value: string) => {
      clearObjectUrlRef(composerPreviewObjectUrlRef);
      clearObjectUrlRef(composerPosterObjectUrlRef);
      setDraft((prev) => ({ ...prev, imageUrl: value, imageDataUrl: "", videoTrim: undefined, videoPosterUrl: undefined }));
      if (value) {
        setUploadedImageBlob(null);
        setUploadedImageFilename("");
      }
    },
    [setDraft]
  );

  const onComposerClearImage = useCallback(() => {
    setDraft((prev) => ({ ...prev, imageDataUrl: "", videoTrim: undefined, videoPosterUrl: undefined }));
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
    clearObjectUrlRef(composerPreviewObjectUrlRef);
    clearObjectUrlRef(composerPosterObjectUrlRef);
  }, [setDraft]);

  const resetMedia = useCallback(() => {
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
    clearObjectUrlRef(composerPreviewObjectUrlRef);
    clearObjectUrlRef(composerPosterObjectUrlRef);
    setDraft((prev) => ({ ...prev, videoTrim: undefined, videoPosterUrl: undefined }));
  }, [setDraft]);

  const processImageFile = useCallback(
    async (file: File, crop?: ImageCropRect) => {
      setIsImageLoading(true);
      setStatus("Processing uploaded image...");

      const maxDataUrlChars = ipfsConfigured ? MAX_IMAGE_DATA_URL_CHARS_IPFS : MAX_IMAGE_DATA_URL_CHARS;
      const candidates = ipfsConfigured ? IMAGE_COMPRESSION_CANDIDATES_IPFS : IMAGE_COMPRESSION_CANDIDATES;

      let best: string | null = null;
      for (const c of candidates) {
        const attempt = await compressToJpegDataUrl(file, c.q, c.dim, crop);
        best = attempt;
        if (attempt.length <= maxDataUrlChars) break;
      }

      if (!best || best.length > maxDataUrlChars) {
        setStatus(
          ipfsConfigured
            ? "Uploaded image is too large. Try a smaller image."
            : "Uploaded image is too large to embed on-chain. Use a smaller image, or paste an image URL (recommended: IPFS/http)."
        );
        return;
      }

      const blobRes = await fetch(best);
      const blob = await blobRes.blob();

      setDraft((prev) => ({ ...prev, imageDataUrl: best!, imageUrl: "", videoTrim: undefined, videoPosterUrl: undefined }));
      setUploadedImageBlob(blob);
      setUploadedImageFilename(file.name || "post-image.jpg");
      setStatus("Uploaded image ready.");
    },
    [ipfsConfigured, setDraft, setStatus]
  );

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

        clearObjectUrlRef(composerPreviewObjectUrlRef);
        clearObjectUrlRef(composerPosterObjectUrlRef);

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

        setStatus("Crop your image...");
        imageCrop.openImageCrop({
          originalFile: file,
          onConfirm: async (result) => {
            try {
              await processImageFile(file, result.crop);
            } catch {
              setStatus("Failed to process cropped image.");
            } finally {
              setIsImageLoading(false);
            }
          },
          onCancel: handleCropCancel
        });
      } catch {
        setStatus("Failed to read image.");
      } finally {
        setIsImageLoading(false);
      }
    },
    [imageCrop, videoTrim, handleTrimSuccess, handleTrimCancel, handleCropCancel, processImageFile, setStatus, ipfsConfigured]
  );

  useEffect(() => {
    return () => {
      clearObjectUrlRef(composerPreviewObjectUrlRef);
      clearObjectUrlRef(composerPosterObjectUrlRef);
    };
  }, []);

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
