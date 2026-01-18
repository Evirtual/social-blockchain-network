import type { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function ensureFFmpeg() {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (!ffmpegLoading) {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const instance = new FFmpeg();
    ffmpegInstance = instance;
    ffmpegLoading = instance
      .load()
      .then(() => {
        return instance;
      })
      .catch((error) => {
        ffmpegInstance = null;
        ffmpegLoading = null;
        throw error;
      });
  }

  return ffmpegLoading;
}

export async function writeFileToFs(path: string, file: File) {
  const ffmpeg = await ensureFFmpeg();
  const buffer = new Uint8Array(await file.arrayBuffer());
  await ffmpeg.writeFile(path, buffer);
  return ffmpeg;
}

export async function readFileFromFs(path: string) {
  const ffmpeg = await ensureFFmpeg();
  return ffmpeg.readFile(path);
}

export async function deleteFsFile(path: string) {
  // Important: don't lazy-create a fresh FFmpeg instance just to clean up.
  // If the caller already reset/terminated FFmpeg (e.g. after abort), this should be a no-op.
  if (!ffmpegInstance && !ffmpegLoading) return;
  const ffmpeg = await ensureFFmpeg();
  await ffmpeg.deleteFile(path);
}

export async function resetFFmpeg() {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    ffmpegLoading = null;
  }
}

export async function probeVideoFrameRate(inputPath: string) {
  const ffmpeg = await ensureFFmpeg();
  const lines: string[] = [];
  const logger = (event: { message: string }) => {
    if (event?.message) {
      lines.push(event.message);
    }
  };
  ffmpeg.on("log", logger);
  try {
    await ffmpeg.exec(["-hide_banner", "-i", inputPath], 2000);
  } catch {
    // ffmpeg will exit with failure because no output is bound, ignore.
  } finally {
    ffmpeg.off("log", logger);
  }

  const text = lines.join("\n");
  const match = text.match(/, (\d+(?:\.\d+)?) fps/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export async function probeStreamCodecs(inputPath: string) {
  const ffmpeg = await ensureFFmpeg();
  const lines: string[] = [];
  const logger = (event: { message: string }) => {
    if (event?.message) {
      lines.push(event.message);
    }
  };
  ffmpeg.on("log", logger);
  try {
    await ffmpeg.exec(["-hide_banner", "-i", inputPath], 2000);
  } catch {
    // ffmpeg will exit with failure because no output is bound, ignore.
  } finally {
    ffmpeg.off("log", logger);
  }

  const text = lines.join("\n");
  const videoMatch = text.match(/Video:\s*([^\s,]+)/);
  const audioMatch = text.match(/Audio:\s*([^\s,]+)/);
  const videoCodec = videoMatch?.[1] ?? null;
  const audioCodec = audioMatch?.[1] ?? null;
  return { videoCodec, audioCodec };
}
