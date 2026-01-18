import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@shared/components/Modal";
import { ipfsToHttp } from "@features/ipfs";
import { VideoTrimSlider } from "./VideoTrimSlider";
import { deleteFsFile, probeStreamCodecs, readFileFromFs, resetFFmpeg, writeFileToFs } from "../services/ffmpeg";
import type { VideoTrimSession } from "../types";

const MIN_CLIP_MS = 1_000;
const MAX_CLIP_MS = 60_000;
const THUMB_MAX_DIM = 640;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatTime = (value: number) => {
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((value % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
};

const formatBytes = (value: number) => {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

type Props = {
  session: VideoTrimSession;
  onClose: (reason: "cancel" | "completed") => void;
};

export function VideoTrimDialog({ session, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState(() => URL.createObjectURL(session.originalFile));
  const [posterUrl, setPosterUrl] = useState<string>("");
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const rangeInitializedRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);
  const posterObjectUrlRef = useRef<string | null>(null);
  const fileInfoText = useMemo(() => {
    const name = session.originalFile.name || "Selected video";
    const durationText = durationMs ? formatTime(durationMs) : "Loading duration";
    return `${name} - ${formatBytes(session.originalFile.size)} - ${durationText}`;
  }, [durationMs, session.originalFile.name, session.originalFile.size]);
  const infoDescription = useMemo(() => {
    const clipSeconds = Math.max(endMs - startMs, 0) / 1000;
    const rounded = clipSeconds.toFixed(2);
    return `Selected range (${rounded}s) is trimmed locally (no re-encode) before replacing the upload.`;
  }, [startMs, endMs]);

  useEffect(() => {
    const url = URL.createObjectURL(session.originalFile);
    setPreviewUrl(url);
    setPosterUrl("");
    setDurationMs(0);
    setStartMs(0);
    setEndMs(0);
    setVideoWidth(0);
    setVideoHeight(0);
    setIsReady(false);
    rangeInitializedRef.current = false;
    return () => {
      URL.revokeObjectURL(url);
      if (posterObjectUrlRef.current) {
        URL.revokeObjectURL(posterObjectUrlRef.current);
        posterObjectUrlRef.current = null;
      }
    };
  }, [session.originalFile]);

  useEffect(() => {
    if (!durationMs || rangeInitializedRef.current) return;
    const availableMinWindow = Math.min(durationMs, MIN_CLIP_MS);
    const availableMaxWindow = Math.min(durationMs, MAX_CLIP_MS);
    const existing = session.existingTrim ?? { startMs: 0, endMs: durationMs };
    const rawStart = clamp(existing.startMs ?? 0, 0, durationMs);
    const rawEnd = clamp(existing.endMs ?? durationMs, rawStart + availableMinWindow, durationMs);
    const span = clamp(rawEnd - rawStart, availableMinWindow, availableMaxWindow);
    const start = clamp(rawStart, 0, durationMs - span);
    const end = start + span;
    setStartMs(start);
    setEndMs(end);
    rangeInitializedRef.current = true;
    setIsReady(true);
  }, [durationMs, session.existingTrim]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }
    setDurationMs(Math.round(video.duration * 1_000));
    setVideoWidth(video.videoWidth);
    setVideoHeight(video.videoHeight);
  }, []);

  const validateVideoBlob = useCallback(async (blob: Blob) => {
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

        timeoutId = window.setTimeout(() => finish(false), 4000);
        video.addEventListener("loadedmetadata", onLoaded);
        video.addEventListener("error", onError);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    const target = startMs / 1000;
    if (Math.abs(video.currentTime - target) > 0.05) {
      video.currentTime = target;
    }
  }, [startMs, isReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    const handleTimeUpdate = () => {
      const currentMs = video.currentTime * 1000;
      if (currentMs >= endMs - 20) {
        video.currentTime = startMs / 1000;
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [startMs, endMs, isReady]);

  const sliderMinWindow = Math.min(MIN_CLIP_MS, durationMs);
  const sliderMaxWindow = Math.min(MAX_CLIP_MS, durationMs);

  const handleCancel = useCallback(() => {
    if (isProcessing) return;
    onClose("cancel");
  }, [isProcessing, onClose]);

  const seekVideoTo = useCallback(
    (timeSec: number) => {
      const video = videoRef.current;
      if (!video) return Promise.reject(new Error("Video not ready"));
      return new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = timeSec;
      });
    },
    []
  );

  const isMostlyBlack = (imageData: ImageData) => {
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
  };

  const captureThumbnail = useCallback(async () => {
    const video = videoRef.current;
    if (!video) throw new Error("Video preview missing");
    const canvas = document.createElement("canvas");
    const sourceWidth = Math.max(video.videoWidth || 0, 1);
    const sourceHeight = Math.max(video.videoHeight || 0, 1);
    const scale = Math.min(1, THUMB_MAX_DIM / Math.max(sourceWidth, sourceHeight));
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
      for (const time of captureTimes) {
        await seekVideoTo(time / 1000);
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        if (!isMostlyBlack(imageData)) {
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
          if (blob) return blob;
        }
      }
      await seekVideoTo(startMs / 1000);
      const fallback = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (fallback) return fallback;
      throw new Error("Unable to capture thumbnail");
    } finally {
      if (wasPlaying) {
        video.play().catch(() => {});
      }
    }
  }, [endMs, seekVideoTo, startMs]);

  useEffect(() => {
    if (!isReady || isProcessing || posterUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await captureThumbnail();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (posterObjectUrlRef.current) {
          URL.revokeObjectURL(posterObjectUrlRef.current);
        }
        posterObjectUrlRef.current = url;
        setPosterUrl(url);
      } catch {
        // ignore poster failures; the user can still play the video
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [captureThumbnail, isProcessing, isReady, posterUrl]);

  const handleConfirm = useCallback(async () => {
    if (!isReady || isProcessing) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    lastProgressUpdateRef.current = 0;
    setErrorMessage(null);
    let aborted = false;
    let outputFsPath = "trim-output.mp4";
    console.info("[video-trim] starting trim", {
      sessionId: session.id,
      startMs,
      endMs,
      totalDurationMs: durationMs
    });
    try {
      const setProgressSafe = (next: number) => {
        const clamped = clamp(next, 0, 1);
        setProcessingProgress((prev) => (clamped > prev ? clamped : prev));
      };

      setProgressSafe(0.02);
      console.info("[video-trim] capturing thumbnail");
      const thumbnailBlob = await captureThumbnail();
      setProgressSafe(0.12);
      console.info("[video-trim] thumbnail captured", { size: thumbnailBlob.size, type: thumbnailBlob.type });
      const trimmedDurationMs = Math.max(endMs - startMs, 1);
      const inputName = "trim-input.mp4";
      const originalType = session.originalFile.type;
      const isMp4 = originalType === "video/mp4" || /\.mp4$/i.test(session.originalFile.name);
      const isWebm = originalType === "video/webm" || /\.webm$/i.test(session.originalFile.name);
      const isOgg = originalType === "video/ogg" || /\.(ogv|ogg)$/i.test(session.originalFile.name);
      const outputExt = isMp4 ? "mp4" : isWebm ? "webm" : isOgg ? "ogg" : "mp4";
      const outputMime = isMp4 ? "video/mp4" : isWebm ? "video/webm" : isOgg ? "video/ogg" : "video/mp4";
      const outputName = `trim-output.${outputExt}`;
      outputFsPath = outputName;
      const ffmpeg = await writeFileToFs(inputName, session.originalFile);
      setProgressSafe(0.2);
      console.info("[video-trim] source written to FS", { path: inputName, size: session.originalFile.size });

      const { videoCodec } = await probeStreamCodecs(inputName);
      const normalizedVideoCodec = videoCodec?.toLowerCase() ?? "";
      const isH264 = normalizedVideoCodec === "h264";
      const shouldTranscode = outputExt === "mp4" && !isH264;

      const startSec = (startMs / 1000).toFixed(3);
      const durationSec = (trimmedDurationMs / 1000).toFixed(3);

      const doTranscodeToMp4 = async (controller: AbortController) => {
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
          inputName,
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
        outputFsPath = "trim-output.mp4";
        await ffmpeg.exec(transcodeArgs, -1, { signal: controller.signal });
      };

      const streamCopyArgs: string[] = [
        "-hide_banner",
        "-ss",
        startSec,
        "-i",
        inputName,
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
      streamCopyArgs.push(outputName);
      const controller = new AbortController();
      setAbortController(controller);
      console.info("[video-trim] executing ffmpeg", { args: shouldTranscode ? "transcode" : streamCopyArgs });

      const progressHandler = (event: { progress?: number; time?: number }) => {
        const now = Date.now();
        if (now - lastProgressUpdateRef.current < 120) return;

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

        // Never show 100% until ffmpeg actually finishes.
        const mapped = 0.2 + ratio * 0.75;
        setProgressSafe(Math.min(mapped, 0.95));
        lastProgressUpdateRef.current = now;
      };

      ffmpeg.on("progress", progressHandler);
      try {
        if (shouldTranscode) {
          await doTranscodeToMp4(controller);
        } else {
          await ffmpeg.exec(streamCopyArgs, -1, { signal: controller.signal });
        }
      } finally {
        ffmpeg.off("progress", progressHandler);
      }

      setProgressSafe(0.97);
      let finalOutputName = shouldTranscode ? "trim-output.mp4" : outputName;
      let finalOutputMime = shouldTranscode ? "video/mp4" : outputMime;
      let outputData = await readFileFromFs(finalOutputName);
      if (!(outputData instanceof Uint8Array)) {
        throw new Error("Trimmed video output is not binary.");
      }
      const normalized = new Uint8Array(outputData);
      let outputBlob = new Blob([normalized], { type: finalOutputMime });
      setProgressSafe(0.99);
      console.info("[video-trim] read back output", { size: outputBlob.size, type: outputBlob.type });

      if (!shouldTranscode) {
        const ok = await validateVideoBlob(outputBlob);
        if (!ok) {
          console.warn("[video-trim] output failed validation, transcoding to H.264/AAC mp4");
          await deleteFsFile(finalOutputName).catch(() => undefined);
          await doTranscodeToMp4(controller);
          finalOutputName = "trim-output.mp4";
          finalOutputMime = "video/mp4";
          outputData = await readFileFromFs(finalOutputName);
          if (!(outputData instanceof Uint8Array)) {
            throw new Error("Trimmed video output is not binary.");
          }
          outputBlob = new Blob([new Uint8Array(outputData)], { type: finalOutputMime });
        }
      }
      const baseName = session.originalFile.name.replace(/\.[^.]+$/, "") || "trimmed";
      const safeName = `${baseName}-trimmed.${finalOutputName.endsWith(".mp4") ? "mp4" : outputExt}`;
      const trimmedFile = new File([outputBlob], safeName, { type: finalOutputMime });
      const result = {
        trimmedFile,
        thumbnailBlob,
        startMs,
        endMs,
        durationMs: trimmedDurationMs
      };
      session.onConfirm(result);
      setProgressSafe(1);
      console.info("[video-trim] finished trim", { trimmedName: safeName, duration: trimmedDurationMs });
      onClose("completed");
    } catch (error) {
      console.error("[video-trim] trim error", error);
      if ((error as DOMException)?.name === "AbortError") {
        aborted = true;
      } else {
        setErrorMessage("Video trimming failed. Try a shorter clip or upload a smaller video.");
        void resetFFmpeg();
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      setProcessingProgress(0);
      if (!aborted) {
        void Promise.all([
          deleteFsFile("trim-input.mp4").catch(() => undefined),
          deleteFsFile(outputFsPath).catch(() => undefined)
        ]);
      }
    }
  }, [
    captureThumbnail,
    endMs,
    isReady,
    isProcessing,
    onClose,
    session,
    startMs,
    validateVideoBlob,
    videoHeight,
    videoWidth
  ]);

  const handleStop = () => {
    if (!abortController) return;
    console.info("[video-trim] abort requested");
    abortController.abort();
    void resetFFmpeg();
  };

  const existingUrl = session.existingVideoUrl ? ipfsToHttp(session.existingVideoUrl) : "";

  return (
    <Modal title="Trim video" open onClose={handleCancel}>
      <div className="videoTrimDialog">
        {existingUrl ? (
          <div className="videoTrimDialogExisting">
            Trimming from <a href={existingUrl} target="_blank" rel="noreferrer">{existingUrl}</a>
          </div>
        ) : null}
        <div className={`videoTrimDialogPreview${isProcessing ? " videoTrimDialogPreviewProcessing" : ""}`}>
          <video
            ref={videoRef}
            className="videoTrimDialogVideo"
            src={previewUrl}
            poster={posterUrl || undefined}
            controls
            playsInline
            preload="metadata"
            muted
            onLoadedMetadata={handleLoadedMetadata}
          />
          {isProcessing ? (
            <div className="videoTrimDialogProcessingOverlay">
              <span>Trimming clip...</span>
              <small>Trimming only the selected range (no re-encode).</small>
              <div
                className="videoTrimDialogProgressBar"
                role="progressbar"
                aria-label="Trimming progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(processingProgress * 100)}
              >
                <div
                  className="videoTrimDialogProgressFill"
                  style={{ width: `${Math.round(processingProgress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="videoTrimDialogInfo">
          <p className="videoTrimDialogInfoMeta">{fileInfoText}</p>
          <p className="videoTrimDialogInfoDescription">{infoDescription}</p>
        </div>
        <div className="videoTrimDialogSliderWrapper">
          {isReady ? (
            <VideoTrimSlider
              minMs={0}
              maxMs={durationMs}
              startMs={startMs}
              endMs={endMs}
              minWindowMs={sliderMinWindow}
              maxWindowMs={sliderMaxWindow}
              onStartChange={setStartMs}
              onEndChange={setEndMs}
              disabled={isProcessing}
            />
          ) : (
            <p className="videoTrimDialogPlaceholder">Loading video metadata...</p>
          )}
        </div>
        <div className="videoTrimDialogMeta">
          <span>Clip duration: {formatTime(endMs - startMs)}</span>
        </div>
        {errorMessage ? <div className="videoTrimDialogError">{errorMessage}</div> : null}
        <div className="rowActions modalFooterInline videoTrimDialogActions">
          <button className="secondary" type="button" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </button>
          {isProcessing ? (
            <button className="secondary videoTrimDialogStop" type="button" onClick={handleStop}>
              Stop
            </button>
          ) : (
            <button className="primary buttonWithSpinner" type="button" onClick={handleConfirm} disabled={!isReady || isProcessing}>
              {isProcessing ? <span className="spinner" aria-hidden="true" /> : null}
              Trim video
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
