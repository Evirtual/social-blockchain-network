import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@shared/components/Modal";
import { ipfsToHttp } from "@features/ipfs";
import { useObjectUrl } from "@shared/hooks/useObjectUrl";
import { clamp } from "@shared/lib/math";
import { VideoTrimSlider } from "./VideoTrimSlider";
import { deleteFsFile, resetFFmpeg } from "../services/ffmpeg";
import { mapTrimRatioToUiProgress } from "../services/progress";
import { captureVideoThumbnail } from "../services/thumbnail";
import { trimVideoFile } from "../services/trim";
import type { VideoTrimSession } from "../types";
import { MAX_CLIP_MS, MIN_CLIP_MS, THUMB_MAX_DIM, TRIM_INPUT_FS_PATH, TRIM_OUTPUT_PREFIX } from "../constants";

const DEBUG_VIDEO_TRIM = import.meta.env.VITE_DEBUG_VIDEO_TRIM === "true";
const videoTrimLog = (...args: unknown[]) => {
  if (DEBUG_VIDEO_TRIM) console.info(...args);
};
const videoTrimWarn = (...args: unknown[]) => {
  if (DEBUG_VIDEO_TRIM) console.warn(...args);
};

const formatTime = (value: number) => {
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((value % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
};

type Props = {
  session: VideoTrimSession;
  onClose: (reason: "cancel" | "completed") => void;
};

export function VideoTrimDialog({ session, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrl = useObjectUrl(session.originalFile);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const posterUrl = useObjectUrl(posterBlob);
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetSessionState = useCallback(() => {
    setPosterBlob(null);
    setDurationMs(0);
    setStartMs(0);
    setEndMs(0);
    setVideoWidth(0);
    setVideoHeight(0);
    setIsReady(false);
    rangeInitializedRef.current = false;
  }, []);

  useEffect(() => {
    resetSessionState();
  }, [resetSessionState, session.originalFile]);

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
  const clipDurationText = useMemo(() => formatTime(Math.max(endMs - startMs, 0)), [endMs, startMs]);

  const handleCancel = useCallback(() => {
    if (isProcessing) return;
    onClose("cancel");
  }, [isProcessing, onClose]);

  const captureThumbnail = useCallback(async () => {
    const video = videoRef.current;
    if (!video) throw new Error("Video preview missing");
    return await captureVideoThumbnail({ video, startMs, endMs, maxDim: THUMB_MAX_DIM });
  }, [endMs, startMs]);

  useEffect(() => {
    if (!isReady || isProcessing || posterBlob) return;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await captureThumbnail();
        if (cancelled) return;
        setPosterBlob(blob);
      } catch {
        // ignore poster failures; the user can still play the video
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [captureThumbnail, isProcessing, isReady, posterBlob]);

  const handleConfirm = useCallback(async () => {
    if (!isReady || isProcessing) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    lastProgressUpdateRef.current = 0;
    setErrorMessage(null);
    let aborted = false;
    let inputFsPath = TRIM_INPUT_FS_PATH;
    let outputFsPath = `${TRIM_OUTPUT_PREFIX}.mp4`;
    videoTrimLog("[video-trim] starting trim", {
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
      videoTrimLog("[video-trim] capturing thumbnail");
      const thumbnailBlob = posterBlob ?? (await captureThumbnail());
      setProgressSafe(0.12);
      videoTrimLog("[video-trim] thumbnail captured", { size: thumbnailBlob.size, type: thumbnailBlob.type });
      const controller = new AbortController();
      setAbortController(controller);
      abortControllerRef.current = controller;

      const trimOutput = await trimVideoFile({
        file: session.originalFile,
        startMs,
        endMs,
        videoWidth,
        videoHeight,
        signal: controller.signal,
        onProgress: (ratio) => {
          const now = Date.now();
          if (now - lastProgressUpdateRef.current < 120) return;
          setProgressSafe(mapTrimRatioToUiProgress(ratio));
          lastProgressUpdateRef.current = now;
        }
      });

      inputFsPath = trimOutput.inputFsPath;
      outputFsPath = trimOutput.outputFsPath;

      setProgressSafe(0.99);
      videoTrimLog("[video-trim] read back output", { size: trimOutput.trimmedFile.size, type: trimOutput.trimmedFile.type });

      const trimmedFile = trimOutput.trimmedFile;
      const result = {
        trimmedFile,
        thumbnailBlob,
        startMs,
        endMs,
        durationMs: Math.max(endMs - startMs, 1)
      };
      session.onConfirm(result);
      setProgressSafe(1);
      videoTrimLog("[video-trim] finished trim", { trimmedName: trimmedFile.name, duration: Math.max(endMs - startMs, 1) });
      onClose("completed");
    } catch (error) {
      console.error("[video-trim] trim error", error);
      if ((error as DOMException)?.name === "AbortError") {
        aborted = true;
        videoTrimWarn("[video-trim] aborted");
      } else {
        setErrorMessage("Video trimming failed. Try a shorter clip or upload a smaller video.");
        void resetFFmpeg();
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      abortControllerRef.current = null;
      setProcessingProgress(0);
      if (!aborted) {
        void Promise.all([deleteFsFile(inputFsPath).catch(() => undefined), deleteFsFile(outputFsPath).catch(() => undefined)]);
      }
    }
  }, [
    captureThumbnail,
    endMs,
    isReady,
    isProcessing,
    onClose,
    posterBlob,
    session,
    startMs,
    videoHeight,
    videoWidth
  ]);

  const handleStop = () => {
    const controller = abortControllerRef.current ?? abortController;
    if (!controller) return;
    videoTrimLog("[video-trim] abort requested");
    controller.abort();
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
              <div><span className="spinner" aria-hidden="true" /> Trimming clip...</div>
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
          <span>Clip duration: {clipDurationText}</span>
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
