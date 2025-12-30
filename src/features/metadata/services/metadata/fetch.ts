import type { TokenMetadata } from "@types";
import { ipfsToHttpCandidates } from "@features/ipfs";
import { parseTokenMetadataFromDataUri, parseTokenMetadataJson } from "./parse";
import {
  clearInFlightTokenMetadata,
  getCachedTokenMetadata,
  getInFlightTokenMetadata,
  setCachedTokenMetadata,
  setInFlightTokenMetadata
} from "./cache";
import type { TokenMetadataFetchResult } from "./cache";
import { getCachedTokenMetadataFromStorage, setCachedTokenMetadataToStorage } from "./storage";

function isPersistableMetadata(meta: TokenMetadata): boolean {
  if (!meta) return false;
  // Persist only if we got *some* useful fields.
  return Object.keys(meta).length > 0;
}

async function fetchTokenMetadataFromNetwork(tokenUri: string): Promise<TokenMetadataFetchResult> {
  const urls = ipfsToHttpCandidates(tokenUri);
  const totalTimeoutMs = 4_500;
  const perAttemptTimeoutMs = Math.max(1_500, Math.floor(totalTimeoutMs / Math.max(1, urls.length)));

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), perAttemptTimeoutMs);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      window.clearTimeout(timeoutId);

      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") continue;
      return { value: parseTokenMetadataJson(json as any), ok: true };
    } catch {
      // Try next gateway.
    }
  }

  return { value: {}, ok: false };
}

export async function fetchTokenMetadata(tokenUri: string): Promise<TokenMetadata> {
  if (!tokenUri) return {};

  const cached = getCachedTokenMetadata(tokenUri);
  if (cached) return cached;

  const persisted = getCachedTokenMetadataFromStorage(tokenUri);
  if (persisted) {
    setCachedTokenMetadata(tokenUri, persisted, { ok: true });
    return persisted;
  }

  const inFlight = getInFlightTokenMetadata(tokenUri);
  if (inFlight) return (await inFlight).value;

  const task: Promise<TokenMetadataFetchResult> = (async () => {
    // Old local-demo format.
    if (tokenUri.startsWith("data:application/json;base64,")) {
      try {
        return { value: parseTokenMetadataFromDataUri(tokenUri), ok: true };
      } catch {
        return { value: {}, ok: false };
      }
    }

    // IPFS/http(s) metadata.
    return await fetchTokenMetadataFromNetwork(tokenUri);
  })();

  setInFlightTokenMetadata(tokenUri, task);
  try {
    const result = await task;
    setCachedTokenMetadata(tokenUri, result.value, { ok: result.ok });
    if (result.ok && isPersistableMetadata(result.value)) {
      setCachedTokenMetadataToStorage(tokenUri, result.value);
    }
    return result.value;
  } finally {
    clearInFlightTokenMetadata(tokenUri, task);
  }
}
