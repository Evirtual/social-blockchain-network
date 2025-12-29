import type { Draft } from "@types";
import { fromBase64, toBase64 } from "../../lib/encoding";

function looksLikeVideoUrl(url: string) {
  const u = url.toLowerCase();
  return u.startsWith("ipfs://")
    ? u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".m4v")
    : u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
}

export function createMetadataUri(draft: Draft) {
  const image = draft.imageDataUrl || draft.imageUrl;
  const isVideo = !!image && looksLikeVideoUrl(image);
  const metadata: any = {
    name: draft.title,
    description: draft.body,
    attributes: [{ trait_type: "Origin", value: "Social Blockchain Network" }]
  };

  if (isVideo) {
    metadata.animation_url = image;
    // Some NFT metadata consumers expect `image` to exist when `animation_url` is present.
    metadata.image = "";
  } else if (image) {
    metadata.image = image;
  }
  const encoded = toBase64(JSON.stringify(metadata));
  return `data:application/json;base64,${encoded}`;
}

export function decodeMetadataUri(metadataURI: string): Draft | null {
  const prefix = "data:application/json;base64,";
  if (!metadataURI.startsWith(prefix)) return null;
  try {
    const decoded = fromBase64(metadataURI.slice(prefix.length));
    const parsed = JSON.parse(decoded) as {
      name?: string;
      description?: string;
      image?: string;
      animation_url?: string;
    };
    return {
      title: typeof parsed.name === "string" ? parsed.name : "",
      body: parsed.description ?? "",
      imageUrl: parsed.animation_url ?? parsed.image ?? "",
      imageDataUrl: ""
    };
  } catch {
    return null;
  }
}
