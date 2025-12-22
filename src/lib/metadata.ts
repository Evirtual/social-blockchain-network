import { ipfsToHttp } from "../ipfs";
import type { Draft, TokenMetadata } from "../types";
import { fromBase64, toBase64 } from "./encoding";

export function createMetadataUri(draft: Draft) {
  const image = draft.imageDataUrl || draft.imageUrl;
  const metadata = {
    description: draft.body,
    image,
    attributes: [{ trait_type: "Origin", value: "Social Blockchain Network" }]
  };
  const encoded = toBase64(JSON.stringify(metadata));
  return `data:application/json;base64,${encoded}`;
}

export function decodeMetadataUri(metadataURI: string): Draft | null {
  const prefix = "data:application/json;base64,";
  if (!metadataURI.startsWith(prefix)) return null;
  try {
    const decoded = fromBase64(metadataURI.slice(prefix.length));
    const parsed = JSON.parse(decoded) as { name?: string; description?: string; image?: string };
    return {
      title: typeof parsed.name === "string" ? parsed.name : "",
      body: parsed.description ?? "",
      imageUrl: parsed.image ?? "",
      imageDataUrl: ""
    };
  } catch {
    return null;
  }
}

export async function fetchTokenMetadata(tokenUri: string): Promise<TokenMetadata> {
  if (!tokenUri) return {};

  // Old local-demo format.
  if (tokenUri.startsWith("data:application/json;base64,")) {
    const decoded = decodeMetadataUri(tokenUri);
    return {
      name: decoded?.title,
      description: decoded?.body,
      image: decoded?.imageUrl
    };
  }

  // IPFS/http(s) metadata.
  try {
    const url = ipfsToHttp(tokenUri);
    const res = await fetch(url);
    if (!res.ok) return {};
    const json = (await res.json()) as any;
    return {
      name: typeof json?.name === "string" ? json.name : undefined,
      description: typeof json?.description === "string" ? json.description : undefined,
      image: typeof json?.image === "string" ? json.image : undefined
    };
  } catch {
    return {};
  }
}
