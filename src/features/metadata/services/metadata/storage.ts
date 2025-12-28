import type { TokenMetadata } from "@types";

const STORAGE_PREFIX = "sbnet:tokenMeta:";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function safeSessionStorageGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage?.setItem(key, value);
  } catch {
    // ignore (storage disabled / full)
  }
}

function hashTokenUri(tokenUri: string): string {
  // Small stable hash to keep sessionStorage keys short.
  // (Not cryptographic; collision is guarded by storing the uri in the payload.)
  let h = 2166136261;
  for (let i = 0; i < tokenUri.length; i++) {
    h ^= tokenUri.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function getStorageKey(tokenUri: string) {
  return `${STORAGE_PREFIX}${hashTokenUri(tokenUri)}`;
}

export function getCachedTokenMetadataFromStorage(tokenUri: string): TokenMetadata | null {
  const raw = safeSessionStorageGet(getStorageKey(tokenUri));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { ts: number; uri: string; value: TokenMetadata };
    if (!parsed || parsed.uri !== tokenUri) return null;
    if (!Number.isFinite(parsed.ts) || Date.now() - parsed.ts > STORAGE_TTL_MS) return null;
    if (typeof parsed.value !== "object" || parsed.value == null) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function setCachedTokenMetadataToStorage(tokenUri: string, value: TokenMetadata) {
  safeSessionStorageSet(getStorageKey(tokenUri), JSON.stringify({ ts: Date.now(), uri: tokenUri, value }));
}
