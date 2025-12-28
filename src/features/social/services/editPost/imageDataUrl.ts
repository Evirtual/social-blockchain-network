import type { Draft } from "@types";
import { createMetadataUri } from "../../../metadata";
import { IMAGE_COMPRESSION_CANDIDATES, MAX_IMAGE_DATA_URL_CHARS, MAX_ONCHAIN_TOKEN_URI_CHARS } from "./constants";

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

  for (const c of IMAGE_COMPRESSION_CANDIDATES) {
    const attempt = await compressToJpegDataUrl(args.file, c.q, c.dim);

    if (attempt.length > MAX_IMAGE_DATA_URL_CHARS) {
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

  if (!best || best.length > MAX_IMAGE_DATA_URL_CHARS) {
    return { ok: false, error: "Uploaded image is too large. Try a smaller image." };
  }

  return { ok: true, dataUrl: best };
}
