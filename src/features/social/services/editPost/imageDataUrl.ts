import type { Draft } from "@types";
import { createMetadataUri } from "@features/metadata";
import type { ImageCropRect } from "@features/imageCrop";
import {
  IMAGE_COMPRESSION_CANDIDATES,
  IMAGE_COMPRESSION_CANDIDATES_IPFS,
  MAX_IMAGE_DATA_URL_CHARS,
  MAX_IMAGE_DATA_URL_CHARS_IPFS,
  MAX_ONCHAIN_TOKEN_URI_CHARS
} from "@features/post/services/draftConstants";

async function decodeImageFromObjectUrl(objectUrl: string) {
  const img = new Image();
  img.decoding = "async";

  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to decode image"));
  });

  img.src = objectUrl;
  await loaded;
  return img;
}

export async function compressToJpegDataUrl(blob: Blob, quality: number, maxDim: number, crop?: ImageCropRect) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await decodeImageFromObjectUrl(objectUrl);

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
}

export async function buildBestImageDataUrl(args: {
  file: File;
  ipfsConfigured: boolean;
  draft: Draft;
  crop?: ImageCropRect;
}): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  let best: string | null = null;

  const candidates = args.ipfsConfigured ? IMAGE_COMPRESSION_CANDIDATES_IPFS : IMAGE_COMPRESSION_CANDIDATES;
  const maxChars = args.ipfsConfigured ? MAX_IMAGE_DATA_URL_CHARS_IPFS : MAX_IMAGE_DATA_URL_CHARS;

  for (const c of candidates) {
    const attempt = await compressToJpegDataUrl(args.file, c.q, c.dim, args.crop);

    if (attempt.length > maxChars) {
      best = attempt;
      continue;
    }

    // If we are falling back to on-chain data URIs, ensure the final metadata URI fits too.
    if (!args.ipfsConfigured) {
      const tokenUriAttempt = createMetadataUri({
        ...args.draft,
        imageUrl: "",
        imageDataUrl: attempt
      });
      if (tokenUriAttempt.length > MAX_ONCHAIN_TOKEN_URI_CHARS) {
        best = attempt;
        continue;
      }
    }

    best = attempt;
    break;
  }

  if (!best || best.length > maxChars) {
    return { ok: false, error: "Uploaded image is too large. Try a smaller image." };
  }

  return { ok: true, dataUrl: best };
}
