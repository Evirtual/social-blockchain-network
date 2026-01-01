import type { TokenMetadata } from "@types";

function hashTokenUri(tokenUri: string): string {
  // Small stable hash to keep keys short.
  // (Not cryptographic; collision is guarded by storing the uri in the payload.)
  let h = 2166136261;
  for (let i = 0; i < tokenUri.length; i++) {
    h ^= tokenUri.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function getStorageKey(tokenUri: string) {
  return hashTokenUri(tokenUri);
}

export function getCachedTokenMetadataFromStorage(tokenUri: string): TokenMetadata | null {
  void tokenUri;
  return null;
}

export function setCachedTokenMetadataToStorage(tokenUri: string, value: TokenMetadata) {
  void tokenUri;
  void value;
  void getStorageKey;
}
