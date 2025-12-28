import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Draft } from "@types";

export function useComposerMedia(params: {
  ipfsConfigured: boolean;
  setStatus: (s: string) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const { ipfsConfigured, setStatus, setDraft } = params;

  const [isImageLoading, setIsImageLoading] = useState(false);
  const [uploadedImageBlob, setUploadedImageBlob] = useState<Blob | null>(null);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<string>("");
  const composerPreviewObjectUrlRef = useRef<string | null>(null);

  const revokePreviewObjectUrl = useCallback(() => {
    if (composerPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(composerPreviewObjectUrlRef.current);
      composerPreviewObjectUrlRef.current = null;
    }
  }, []);

  const onComposerImageUrlChange = useCallback(
    (value: string) => {
      revokePreviewObjectUrl();
      setDraft((prev) => ({ ...prev, imageUrl: value, imageDataUrl: "" }));
      if (value) {
        setUploadedImageBlob(null);
        setUploadedImageFilename("");
      }
    },
    [revokePreviewObjectUrl, setDraft]
  );

  const onComposerClearImage = useCallback(() => {
    setDraft((prev) => ({ ...prev, imageDataUrl: "" }));
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
    revokePreviewObjectUrl();
  }, [revokePreviewObjectUrl, setDraft]);

  const resetMedia = useCallback(() => {
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
    revokePreviewObjectUrl();
  }, [revokePreviewObjectUrl]);

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
    [ipfsConfigured, revokePreviewObjectUrl, setDraft, setStatus]
  );

  useEffect(() => {
    return () => {
      revokePreviewObjectUrl();
    };
  }, [revokePreviewObjectUrl]);

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
