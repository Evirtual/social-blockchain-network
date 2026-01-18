import { clamp } from "@shared/lib/math";
import { TRIM_INPUT_FS_PATH, TRIM_OUTPUT_PREFIX } from "../constants";
import { deleteFsFile, probeStreamCodecs, readFileFromFs, writeFileToFs } from "./ffmpeg";

type ValidateBlobOptions = {
  blob: Blob;
  timeoutMs?: number;
};

async function validateVideoBlob({ blob, timeoutMs = 4000 }: ValidateBlobOptions) {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    return await new Promise<boolean>((resolve) => {
      let timeoutId: number | null = null;
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
        resolve(ok);
      };

      const onLoaded = () => finish(Number.isFinite(video.duration) && video.duration > 0);
      const onError = () => finish(false);

      timeoutId = window.setTimeout(() => finish(false), timeoutMs);
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function execWithTimeout(run: () => Promise<unknown>, timeoutMs: number) {
  let timeoutId: number | null = null;
  try {
    await Promise.race([
      run(),
      new Promise<void>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("FFmpeg timed out")), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export type TrimVideoOutput = {
  inputFsPath: string;
  outputFsPath: string;
  trimmedFile: File;
};

export async function trimVideoFile(options: {
  file: File;
  startMs: number;
  endMs: number;
  videoWidth: number;
  videoHeight: number;
  signal: AbortSignal;
  onProgress?: (ratio: number) => void;
}) : Promise<TrimVideoOutput> {
  const { file, startMs, endMs, videoWidth, videoHeight, signal, onProgress } = options;

  const trimmedDurationMs = Math.max(endMs - startMs, 1);
  const startSec = (startMs / 1000).toFixed(3);
  const durationSec = (trimmedDurationMs / 1000).toFixed(3);

  const inputFsPath = TRIM_INPUT_FS_PATH;
  const originalType = file.type;
  const isMp4 = originalType === "video/mp4" || /\.mp4$/i.test(file.name);
  const isWebm = originalType === "video/webm" || /\.webm$/i.test(file.name);
  const isOgg = originalType === "video/ogg" || /\.(ogv|ogg)$/i.test(file.name);

  const outputExt = isMp4 ? "mp4" : isWebm ? "webm" : isOgg ? "ogg" : "mp4";
  const outputMime = isMp4 ? "video/mp4" : isWebm ? "video/webm" : isOgg ? "video/ogg" : "video/mp4";
  let outputFsPath = `${TRIM_OUTPUT_PREFIX}.${outputExt}`;
  let outputFileName = `${file.name.replace(/\.[^.]+$/, "") || "trimmed"}-trimmed.${outputExt}`;

  const ffmpeg = await writeFileToFs(inputFsPath, file);

  const progressHandler = (event: { progress?: number; time?: number }) => {
    const rawTimeUs = event?.time ?? 0;
    const rawProgress = event?.progress ?? 0;
    const timeMs = Number.isFinite(rawTimeUs) ? rawTimeUs / 1000 : 0;
    const ratioFromTime =
      trimmedDurationMs > 0 && Number.isFinite(timeMs) && timeMs >= 0 && timeMs < trimmedDurationMs * 10
        ? clamp(timeMs / trimmedDurationMs, 0, 1)
        : 0;
    const ratioFromProgress =
      Number.isFinite(rawProgress) && rawProgress > 0 && rawProgress <= 1 ? clamp(rawProgress, 0, 1) : 0;
    const ratio = Math.max(ratioFromTime, ratioFromProgress);
    onProgress?.(ratio);
  };

  ffmpeg.on("progress", progressHandler);
  try {
    const { videoCodec } = await probeStreamCodecs(inputFsPath);
    const normalizedVideoCodec = videoCodec?.toLowerCase() ?? "";
    const isH264 = normalizedVideoCodec === "h264";
    const shouldTranscode = outputExt === "mp4" && !isH264;

    const transcodeToMp4 = async () => {
      const width = Math.max(2, videoWidth);
      const height = Math.max(2, videoHeight);
      const isPortrait = height >= width;
      const maxW = isPortrait ? 1080 : 1920;
      const maxH = isPortrait ? 1920 : 1080;
      const scaleFactor = Math.min(1, maxW / width, maxH / height);
      const scaledWidth = Math.max(2, Math.floor((width * scaleFactor) / 2) * 2);
      const scaledHeight = Math.max(2, Math.floor((height * scaleFactor) / 2) * 2);
      const useScale = scaledWidth !== width || scaledHeight !== height;

      const transcodeArgs: string[] = [
        "-hide_banner",
        "-ss",
        startSec,
        "-i",
        inputFsPath,
        "-t",
        durationSec,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-sn",
        "-dn",
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-level",
        "4.1",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-pix_fmt",
        "yuv420p",
        "-metadata:s:v:0",
        "rotate=0",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        "-avoid_negative_ts",
        "make_zero"
      ];
      if (useScale) {
        transcodeArgs.push("-vf", `scale=${scaledWidth}:${scaledHeight}`);
      }
      transcodeArgs.push("trim-output.mp4");

      outputFsPath = `${TRIM_OUTPUT_PREFIX}.mp4`;
      outputFileName = `${file.name.replace(/\.[^.]+$/, "") || "trimmed"}-trimmed.mp4`;

      await execWithTimeout(() => ffmpeg.exec(transcodeArgs, -1, { signal }), 6 * 60_000);
    };

    const streamCopyArgs: string[] = [
      "-hide_banner",
      "-ss",
      startSec,
      "-i",
      inputFsPath,
      "-t",
      durationSec,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-sn",
      "-dn",
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero"
    ];
    if (outputExt === "mp4") {
      streamCopyArgs.push("-movflags", "+faststart");
    }
    streamCopyArgs.push(outputFsPath);

    if (shouldTranscode) {
      await transcodeToMp4();
    } else {
      await execWithTimeout(() => ffmpeg.exec(streamCopyArgs, -1, { signal }), 60_000);
    }

    let outputData = await readFileFromFs(outputFsPath);
    if (!(outputData instanceof Uint8Array)) {
      throw new Error("Trimmed video output is not binary.");
    }

    let finalMime = outputFsPath.endsWith(".mp4") ? "video/mp4" : outputMime;
    let outputBlob = new Blob([new Uint8Array(outputData)], { type: finalMime });

    if (!shouldTranscode) {
      const ok = await validateVideoBlob({ blob: outputBlob });
      if (!ok) {
        await deleteFsFile(outputFsPath).catch(() => undefined);
        await transcodeToMp4();
        outputData = await readFileFromFs(outputFsPath);
        if (!(outputData instanceof Uint8Array)) {
          throw new Error("Trimmed video output is not binary.");
        }
        finalMime = "video/mp4";
        outputBlob = new Blob([new Uint8Array(outputData)], { type: finalMime });
      }
    }

    const trimmedFile = new File([outputBlob], outputFileName, { type: finalMime });
    return { inputFsPath, outputFsPath, trimmedFile };
  } catch (error) {
    // Best-effort cleanup if we failed after creating output.
    await Promise.all([deleteFsFile(`${TRIM_OUTPUT_PREFIX}.mp4`).catch(() => undefined), deleteFsFile(outputFsPath).catch(() => undefined)]);
    throw error;
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}
