import type { TokenMetadata } from "@types";
import { fromBase64 } from "../../lib/encoding";

export type TokenMetadataJson = {
  name?: string | null;
  description?: string | null;
  image?: string | null;
  animation_url?: string | null;
};

export function parseTokenMetadataJson(json: TokenMetadataJson | null | undefined): TokenMetadata {
  return {
    name: typeof json?.name === "string" ? json.name : undefined,
    description: typeof json?.description === "string" ? json.description : undefined,
    image: typeof json?.image === "string" ? json.image : undefined,
    animation_url: typeof json?.animation_url === "string" ? json.animation_url : undefined
  };
}

export function parseTokenMetadataFromDataUri(tokenUri: string): TokenMetadata {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) return {};

  try {
    const decoded = fromBase64(tokenUri.slice(prefix.length));
    const json = JSON.parse(decoded) as TokenMetadataJson;
    return parseTokenMetadataJson(json);
  } catch {
    return {};
  }
}
