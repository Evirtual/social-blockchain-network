import type { Draft } from "@types";
import { ipfsToHttp, makeUniqueFilename, makeUniquePinName, pinataPinFile, pinataPinJson } from "./ipfs";

function toPinataName(input: string, fallback: string) {
  const cleaned = String(input ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const name = cleaned || fallback;
  return name.length > 120 ? name.slice(0, 120) : name;
}

export async function buildIpfsTokenUri(input: {
  draft: Draft;
  imageBlob: Blob | null;
  imageFilename: string;
  mediaTypeHint?: "image" | "video";
}): Promise<{ tokenUri: string; imageRef: string; animationRef: string }> {
  const looksLikeVideoUrl = (url: string) => {
    const u = url.toLowerCase();
    return u.startsWith("ipfs://")
      ? u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".m4v")
      : u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
  };

  let imageRef = "";
  let animationRef = "";

  if (input.imageBlob) {
    const base = toPinataName(input.imageFilename || "post-media", "post-media");
    const uniqueName = makeUniquePinName(base);
    const uniqueFilename = makeUniqueFilename(input.imageFilename || "post-media", input.imageBlob.type);
    const fileRes = await pinataPinFile(input.imageBlob, uniqueFilename, uniqueName);
    const mediaRef = `ipfs://${fileRes.IpfsHash}`;
    const isVideo = input.imageBlob.type?.startsWith("video/") ?? false;
    if (isVideo) animationRef = mediaRef;
    else imageRef = mediaRef;
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
          const uniqueName = makeUniquePinName("post-media");
          const uniqueFilename = makeUniqueFilename("post-media", blob.type);
          const fileRes = await pinataPinFile(blob, uniqueFilename, uniqueName);
          const mediaRef = `ipfs://${fileRes.IpfsHash}`;
          if (blob.type.startsWith("video/")) animationRef = mediaRef;
          else if (blob.type.startsWith("image/")) imageRef = mediaRef;
          else if (input.mediaTypeHint === "video") animationRef = mediaRef;
          else imageRef = mediaRef;
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
  } = {
    name: input.draft.title,
    description: input.draft.body,
    attributes: [{ trait_type: "Origin", value: "Social Blockchain Network" }]
  };
  if (imageRef) metadata.image = imageRef;
  if (animationRef) {
    metadata.animation_url = animationRef;
    if (!metadata.image) metadata.image = "";
  }

  const metaRes = await pinataPinJson(
    metadata,
    makeUniquePinName(toPinataName(metadata.name ?? "", "post-metadata"))
  );
  return {
    tokenUri: `ipfs://${metaRes.IpfsHash}`,
    imageRef,
    animationRef
  };
}
