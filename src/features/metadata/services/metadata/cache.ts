import type { TokenMetadata } from "@types";

export type TokenMetadataFetchResult = { value: TokenMetadata; ok: boolean };

const OK_TTL_MS = 30 * 60 * 1000;
const ERROR_TTL_MS = 20 * 1000;

const tokenMetadataCache = new Map<string, { value: TokenMetadata; ts: number; ok: boolean }>();
const tokenMetadataInFlight = new Map<string, Promise<TokenMetadataFetchResult>>();

export function getCachedTokenMetadata(tokenUri: string): TokenMetadata | null {
  const hit = tokenMetadataCache.get(tokenUri);
  if (!hit) return null;

  // Keep successful metadata longer; failures are cached briefly to avoid hammering gateways.
  const ttl = hit.ok ? OK_TTL_MS : ERROR_TTL_MS;
  if (Date.now() - hit.ts > ttl) {
    tokenMetadataCache.delete(tokenUri);
    return null;
  }
  return hit.value;
}

export function setCachedTokenMetadata(tokenUri: string, value: TokenMetadata, opts?: { ok?: boolean }) {
  tokenMetadataCache.set(tokenUri, { value, ts: Date.now(), ok: opts?.ok ?? true });
}

export function getInFlightTokenMetadata(tokenUri: string) {
  return tokenMetadataInFlight.get(tokenUri);
}

export function setInFlightTokenMetadata(tokenUri: string, task: Promise<TokenMetadataFetchResult>) {
  tokenMetadataInFlight.set(tokenUri, task);
}

export function clearInFlightTokenMetadata(tokenUri: string, task: Promise<TokenMetadataFetchResult>) {
  if (tokenMetadataInFlight.get(tokenUri) === task) tokenMetadataInFlight.delete(tokenUri);
}
