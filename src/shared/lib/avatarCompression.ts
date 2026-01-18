type CompressAvatarResult = {
  ok: true;
  blob: Blob;
  dataUrl: string;
  filename: string;
} | {
  ok: false;
  error: string;
};

function stripExtension(filename: string): string {
  const trimmed = String(filename || "").trim();
  const idx = trimmed.lastIndexOf(".");
  if (idx <= 0) return trimmed || "avatar";
  return trimmed.slice(0, idx) || "avatar";
}

function extensionForMime(mime: string): string {
  const m = String(mime || "").toLowerCase();
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  return "jpg";
}

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(blob);
  });
}

async function decodeImageFromObjectUrl(objectUrl: string): Promise<HTMLImageElement> {
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

async function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}

/**
 * Resizes + compresses avatar images for IPFS.
 * - Keeps avatars visually crisp (high quality) but avoids uploading raw multi-megapixel photos.
 * - Prefers WebP when supported; falls back to JPEG.
 * - Skips GIF re-encoding (canvas would drop animation frames).
 */
export async function compressAvatarForIpfs(args: {
  file: File;
  maxDim?: number;
  quality?: number;
  crop?: { left: number; top: number; right: number; bottom: number };
}): Promise<CompressAvatarResult> {
  const maxDim = Math.max(64, Math.round(Number(args.maxDim ?? 512)));
  const quality = Math.min(0.98, Math.max(0.5, Number(args.quality ?? 0.9)));

  const file = args.file;
  if (!file || !(file instanceof Blob)) return { ok: false, error: "Invalid file" };

  // Keep GIFs as-is to preserve animation.
  if (String(file.type).toLowerCase() === "image/gif") {
    const dataUrl = await readBlobAsDataUrl(file);
    return { ok: true, blob: file, dataUrl, filename: file.name || "avatar.gif" };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await decodeImageFromObjectUrl(objectUrl);

    const naturalWidth = Math.max(1, img.width);
    const naturalHeight = Math.max(1, img.height);

    const crop = args.crop
      ? {
          left: Math.min(Math.max(args.crop.left, 0), 1),
          top: Math.min(Math.max(args.crop.top, 0), 1),
          right: Math.min(Math.max(args.crop.right, 0), 1),
          bottom: Math.min(Math.max(args.crop.bottom, 0), 1)
        }
      : null;

    const left = crop ? Math.min(crop.left, crop.right) : 0;
    const right = crop ? Math.max(crop.left, crop.right) : 1;
    const top = crop ? Math.min(crop.top, crop.bottom) : 0;
    const bottom = crop ? Math.max(crop.top, crop.bottom) : 1;

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
    if (!ctx) return { ok: false, error: "Canvas not supported" };

    ctx.imageSmoothingEnabled = true;
    (ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }).imageSmoothingQuality = "high";

    // Avoid black backgrounds if we end up using JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

    let out: Blob | null = null;
    let outMime = "image/webp";

    out = await canvasToBlob(canvas, outMime, quality);
    if (!out || out.size === 0) {
      outMime = "image/jpeg";
      out = await canvasToBlob(canvas, outMime, quality);
    }

    if (!out || out.size === 0) return { ok: false, error: "Failed to encode image" };

    const base = stripExtension(file.name || "avatar");
    const filename = `${base}.${extensionForMime(outMime)}`;
    const dataUrl = await readBlobAsDataUrl(out);
    return { ok: true, blob: out, dataUrl, filename };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to process image" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
