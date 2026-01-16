import type { Draft } from "@types";
import {
  makeUploadNonce,
  ipfsToHttp,
  makePinataBaseName,
  makeUniqueFilename,
  makeUniquePinName,
  pinataPinFile,
  pinataPinJson,
  type PinataNameContext
} from "./ipfs";

async function bestEffortCreateVideoThumbnail(videoBlob: Blob): Promise<Blob | null> {
  if (!videoBlob?.type?.startsWith("video/")) return null;
  if (typeof document === "undefined") return null;

  const video = document.createElement("video");
  let objectUrl: string | null = null;
  const cleanup = () => {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
      objectUrl = null;
    }
    try {
      video.removeAttribute("src");
      video.load();
    } catch {
      // ignore
    }
  };

  try {
    objectUrl = URL.createObjectURL(videoBlob);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const waitFor = (eventName: "loadedmetadata" | "loadeddata" | "seeked", ms: number) =>
      new Promise<void>((resolve, reject) => {
        const onEvent = () => {
          cleanupListeners();
          resolve();
        };
        const onError = () => {
          cleanupListeners();
          reject(new Error("video-thumbnail: video error"));
        };
        const onTimeout = () => {
          cleanupListeners();
          reject(new Error(`video-thumbnail: timeout waiting for ${eventName}`));
        };
        const timer = setTimeout(onTimeout, ms);
        const cleanupListeners = () => {
          clearTimeout(timer);
          video.removeEventListener(eventName, onEvent);
          video.removeEventListener("error", onError);
        };
        video.addEventListener(eventName, onEvent, { once: true });
        video.addEventListener("error", onError, { once: true });
      });

    await waitFor("loadedmetadata", 6000);
    await waitFor("loadeddata", 6000);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const seekTarget = duration > 1 ? Math.min(1, Math.max(0, duration - 0.15)) : 0;
    if (seekTarget > 0) {
      video.currentTime = seekTarget;
      await waitFor("seeked", 6000);
    }

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    if (!srcW || !srcH) {
      cleanup();
      return null;
    }

    const maxDim = 512;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanup();
      return null;
    }

    ctx.drawImage(video, 0, 0, outW, outH);

    const thumb = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
    });

    if (!thumb) return null;
    return thumb;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

export async function buildIpfsTokenUri(input: {
  draft: Draft;
  imageBlob: Blob | null;
  imageFilename: string;
  mediaTypeHint?: "image" | "video";
  pinNameContext?: Omit<Extract<PinataNameContext, { kind: "post" }>, "purpose" | "title">;
}): Promise<{ tokenUri: string; imageRef: string; animationRef: string }> {
  const looksLikeVideoUrl = (url: string) => {
    const u = url.toLowerCase();
    return u.startsWith("ipfs://")
      ? u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".m4v")
      : u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
  };

  let imageRef = "";
  let animationRef = "";

  const baseMedia = makePinataBaseName({
    kind: "post",
    purpose: "media",
    title: input.draft.title,
    ...(input.pinNameContext ?? {})
  });

  const baseMeta = makePinataBaseName({
    kind: "post",
    purpose: "metadata",
    title: input.draft.title,
    ...(input.pinNameContext ?? {})
  });

  if (input.imageBlob) {
    const isVideo = input.imageBlob.type?.startsWith("video/") ?? false;
    if (isVideo) {
      const posterBlob = await bestEffortCreateVideoThumbnail(input.imageBlob);
      if (posterBlob) {
        const baseThumb = `${baseMedia} thumb`;
        const uniquePosterName = makeUniquePinName(baseThumb);
        const uniquePosterFilename = makeUniqueFilename(baseThumb, posterBlob.type);
        const posterRes = await pinataPinFile(posterBlob, uniquePosterFilename, uniquePosterName, {
          wrapWithDirectory: true
        });
        imageRef = `ipfs://${posterRes.IpfsHash}/${uniquePosterFilename}`;
      }

      const uniqueName = makeUniquePinName(baseMedia);
      const uniqueFilename = makeUniqueFilename(baseMedia, input.imageBlob.type);
      const fileRes = await pinataPinFile(input.imageBlob, uniqueFilename, uniqueName, { wrapWithDirectory: true });
      animationRef = `ipfs://${fileRes.IpfsHash}/${uniqueFilename}`;
    } else {
      const uniqueName = makeUniquePinName(baseMedia);
      const uniqueFilename = makeUniqueFilename(baseMedia, input.imageBlob.type);
      const fileRes = await pinataPinFile(input.imageBlob, uniqueFilename, uniqueName, { wrapWithDirectory: true });
      imageRef = `ipfs://${fileRes.IpfsHash}/${uniqueFilename}`;
    }
  } else if (input.draft.imageUrl) {
    const url = input.draft.imageUrl.trim();
    // Browsers can't fetch ipfs:// URLs directly. If the user pasted an IPFS URI,
    // treat it as an already-hosted ref and avoid re-pinning.
    if (url.startsWith("ipfs://")) {
      // If the URL doesn't include a file extension (common for ipfs://<CID>),
      // we can't reliably infer whether it is a video. Allow the caller to hint.
      const hinted = input.mediaTypeHint;
      if (hinted === "video") animationRef = url;
      else if (hinted === "image") imageRef = url;
      else if (looksLikeVideoUrl(url)) animationRef = url;
      else imageRef = url;
    } else {
      try {
        const res = await fetch(ipfsToHttp(url));
        if (res.ok) {
          const blob = await res.blob();
          if (blob.type.startsWith("video/")) {
            const posterBlob = await bestEffortCreateVideoThumbnail(blob);
            if (posterBlob) {
              const baseThumb = `${baseMedia} thumb`;
              const uniquePosterName = makeUniquePinName(baseThumb);
              const uniquePosterFilename = makeUniqueFilename(baseThumb, posterBlob.type);
              const posterRes = await pinataPinFile(posterBlob, uniquePosterFilename, uniquePosterName, {
                wrapWithDirectory: true
              });
              imageRef = `ipfs://${posterRes.IpfsHash}/${uniquePosterFilename}`;
            }

            const uniqueName = makeUniquePinName(baseMedia);
            const uniqueFilename = makeUniqueFilename(baseMedia, blob.type);
            const fileRes = await pinataPinFile(blob, uniqueFilename, uniqueName, { wrapWithDirectory: true });
            animationRef = `ipfs://${fileRes.IpfsHash}/${uniqueFilename}`;
          } else {
            const uniqueName = makeUniquePinName(baseMedia);
            const uniqueFilename = makeUniqueFilename(baseMedia, blob.type);
            const fileRes = await pinataPinFile(blob, uniqueFilename, uniqueName, { wrapWithDirectory: true });
            const mediaRef = `ipfs://${fileRes.IpfsHash}/${uniqueFilename}`;
            if (blob.type.startsWith("image/")) imageRef = mediaRef;
            else if (input.mediaTypeHint === "video") animationRef = mediaRef;
            else imageRef = mediaRef;
          }
        } else {
          if (looksLikeVideoUrl(url)) animationRef = url;
          else imageRef = url;
        }
      } catch {
        if (looksLikeVideoUrl(url)) animationRef = url;
        else imageRef = url;
      }
    }
  }

  const metadata: {
    name?: string;
    description?: string;
    image?: string;
    animation_url?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
    sbnet_upload_nonce?: string;
  } = {
    name: input.draft.title,
    description: input.draft.body,
    attributes: [{ trait_type: "Origin", value: "Social Blockchain Network" }],
    // Ensures a new CID (and Pinata entry) even if content is otherwise identical.
    sbnet_upload_nonce: makeUploadNonce()
  };
  if (imageRef) metadata.image = imageRef;
  if (animationRef) {
    metadata.animation_url = animationRef;
    if (!metadata.image) metadata.image = "";
  }

  const metaRes = await pinataPinJson(
    metadata,
    makeUniquePinName(baseMeta)
  );
  return {
    tokenUri: `ipfs://${metaRes.IpfsHash}`,
    imageRef,
    animationRef
  };
}
