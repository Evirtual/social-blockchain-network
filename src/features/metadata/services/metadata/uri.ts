import type { Draft } from "@types";
import { toBase64 } from "../../lib/encoding";

function looksLikeVideoUrl(url: string) {
  const u = url.toLowerCase();
  return u.startsWith("ipfs://")
    ? u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".m4v")
    : u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
}

export function createMetadataUri(draft: Draft) {
  const image = draft.imageDataUrl || draft.imageUrl;
  const isVideo = !!image && looksLikeVideoUrl(image);
  const metadata: {
    name?: string;
    description?: string;
    image?: string;
    animation_url?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  } = {
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
