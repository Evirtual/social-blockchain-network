import type { Draft } from "@types";
import { createMetadataUri } from "@features/metadata";
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

export async function compressToJpegDataUrl(blob: Blob, quality: number, maxDim: number) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await decodeImageFromObjectUrl(objectUrl);

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
}

export async function buildBestImageDataUrl(args: {
  file: File;
  ipfsConfigured: boolean;
  draft: Draft;
}): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  let best: string | null = null;

  const candidates = args.ipfsConfigured ? IMAGE_COMPRESSION_CANDIDATES_IPFS : IMAGE_COMPRESSION_CANDIDATES;
  const maxChars = args.ipfsConfigured ? MAX_IMAGE_DATA_URL_CHARS_IPFS : MAX_IMAGE_DATA_URL_CHARS;

  for (const c of candidates) {
    const attempt = await compressToJpegDataUrl(args.file, c.q, c.dim);

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
