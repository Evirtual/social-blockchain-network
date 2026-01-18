import { clamp } from "@shared/lib/math";

function isMostlyBlack(imageData: ImageData) {
  const { data } = imageData;
  const sampleCount = Math.min(80, Math.floor(data.length / 4));
  if (!sampleCount) return false;
  let sum = 0;
  const step = Math.max(1, Math.floor(data.length / 4 / sampleCount));
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum += (r + g + b) / 3;
  }
  const avg = sum / sampleCount;
  return avg < 8;
}

async function seekVideoTo(video: HTMLVideoElement, timeSec: number, timeoutMs: number) {
  return await new Promise<void>((resolve, reject) => {
    let timeoutId: number | null = null;
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (err) reject(err);
      else resolve();
    };
    const onSeeked = () => finish();
    const onError = () => finish(new Error("Video seek failed"));
    timeoutId = window.setTimeout(() => finish(new Error("Video seek timed out")), timeoutMs);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = timeSec;
  });
}

export async function captureVideoThumbnail(options: {
  video: HTMLVideoElement;
  startMs: number;
  endMs: number;
  maxDim: number;
  seekTimeoutMs?: number;
}) {
  const { video, startMs, endMs, maxDim, seekTimeoutMs = 2500 } = options;

  const canvas = document.createElement("canvas");
  const sourceWidth = Math.max(video.videoWidth || 0, 1);
  const sourceHeight = Math.max(video.videoHeight || 0, 1);
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round((sourceWidth * scale) / 2) * 2);
  const height = Math.max(1, Math.round((sourceHeight * scale) / 2) * 2);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const captureTimes = [
    clamp(startMs + 200, startMs, endMs),
    clamp(startMs + Math.max(500, (endMs - startMs) / 2), startMs, endMs),
    clamp(endMs - 100, startMs, endMs)
  ];

  const wasPlaying = !video.paused;
  video.pause();
  try {
    for (const timeMs of captureTimes) {
      try {
        await seekVideoTo(video, timeMs / 1000, seekTimeoutMs);
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        if (!isMostlyBlack(imageData)) {
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
          if (blob) return blob;
        }
      } catch {
        // try next timestamp
      }
    }

    await seekVideoTo(video, startMs / 1000, seekTimeoutMs);
    const fallback = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (fallback) return fallback;
    throw new Error("Unable to capture thumbnail");
  } finally {
    if (wasPlaying) {
      video.play().catch(() => {});
    }
  }
}

