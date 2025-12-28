import { ipfsToHttp } from "../ipfs";
import type { Draft, TokenMetadata } from "../types";
import { fromBase64, toBase64 } from "./encoding";

const tokenMetadataCache = new Map<string, { value: TokenMetadata; ts: number }>();
const tokenMetadataInFlight = new Map<string, Promise<TokenMetadata>>();

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

function getCachedTokenMetadataFromStorage(tokenUri: string): TokenMetadata | null {
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

function setCachedTokenMetadataToStorage(tokenUri: string, value: TokenMetadata) {
  safeSessionStorageSet(
    getStorageKey(tokenUri),
    JSON.stringify({ ts: Date.now(), uri: tokenUri, value })
  );
}

function getCachedTokenMetadata(tokenUri: string): TokenMetadata | null {
  const hit = tokenMetadataCache.get(tokenUri);
  if (!hit) return null;
  // 5 minutes TTL keeps refresh fast without risking stale data.
  if (Date.now() - hit.ts > 5 * 60 * 1000) {
    tokenMetadataCache.delete(tokenUri);
    return null;
  }
  return hit.value;
}

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

export async function fetchTokenMetadata(tokenUri: string): Promise<TokenMetadata> {
  if (!tokenUri) return {};

  const cached = getCachedTokenMetadata(tokenUri);
  if (cached) return cached;

  const persisted = getCachedTokenMetadataFromStorage(tokenUri);
  if (persisted) {
    tokenMetadataCache.set(tokenUri, { value: persisted, ts: Date.now() });
    return persisted;
  }

  const inFlight = tokenMetadataInFlight.get(tokenUri);
  if (inFlight) return await inFlight;

  const task = (async () => {
    // Old local-demo format.
    if (tokenUri.startsWith("data:application/json;base64,")) {
      const prefix = "data:application/json;base64,";
      try {
        const decoded = fromBase64(tokenUri.slice(prefix.length));
        const json = JSON.parse(decoded) as any;
        return {
          name: typeof json?.name === "string" ? json.name : undefined,
          description: typeof json?.description === "string" ? json.description : undefined,
          image: typeof json?.image === "string" ? json.image : undefined,
          animation_url: typeof json?.animation_url === "string" ? json.animation_url : undefined
        };
      } catch {
        return {};
      }
    }

    // IPFS/http(s) metadata.
    try {
      const url = ipfsToHttp(tokenUri);
      // Metadata fetches can be slow/unreliable (IPFS gateways, large responses).
      // Keep the feed responsive by timing out and falling back to empty metadata.
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 4_500);
      const res = await fetch(url, { signal: controller.signal });
      window.clearTimeout(timeoutId);
      if (!res.ok) return {};
      const json = (await res.json()) as any;
      return {
        name: typeof json?.name === "string" ? json.name : undefined,
        description: typeof json?.description === "string" ? json.description : undefined,
        image: typeof json?.image === "string" ? json.image : undefined,
        animation_url: typeof json?.animation_url === "string" ? json.animation_url : undefined
      };
    } catch {
      return {};
    }
  })();

  tokenMetadataInFlight.set(tokenUri, task);
  try {
    const value = await task;
    tokenMetadataCache.set(tokenUri, { value, ts: Date.now() });
    setCachedTokenMetadataToStorage(tokenUri, value);
    return value;
  } finally {
    if (tokenMetadataInFlight.get(tokenUri) === task) tokenMetadataInFlight.delete(tokenUri);
  }
}
