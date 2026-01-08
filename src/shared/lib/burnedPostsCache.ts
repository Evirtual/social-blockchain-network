import { readSessionCache, writeSessionCache } from "./sessionCache";
import { parseChainKey } from "./chainKey";

type CacheShape = {
  keys: string[];
  ts: number;
};

const CACHE_KEY = "socialBlockchainNetwork.burnedPosts";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let inMemory: Set<string> | null = null;

function loadCache(): Set<string> {
  if (inMemory) return inMemory;
  const cached = readSessionCache<CacheShape>(CACHE_KEY);
  const now = Date.now();
  if (cached && Array.isArray(cached.keys) && typeof cached.ts === "number" && now - cached.ts < CACHE_TTL_MS) {
    inMemory = new Set(cached.keys.filter((k) => typeof k === "string" && k.trim()));
  } else {
    inMemory = new Set();
  }
  return inMemory;
}

function persistCache(next: Set<string>) {
  inMemory = next;
  writeSessionCache(CACHE_KEY, { keys: Array.from(next), ts: Date.now() });
}

export function buildBurnedKey(chainId: string | null | undefined, tokenId: string) {
  const chainKey = parseChainKey(chainId ?? null);
  return chainKey ? `${chainKey}:${tokenId}` : tokenId;
}

export function markPostBurned(chainId: string | null | undefined, tokenId: string) {
  const key = buildBurnedKey(chainId, tokenId);
  const next = loadCache();
  next.add(key);
  next.add(buildBurnedKey(null, tokenId));
  persistCache(next);
}

export function isPostBurned(chainId: string | null | undefined, tokenId: string) {
  const cache = loadCache();
  const key = buildBurnedKey(chainId, tokenId);
  if (cache.has(key)) return true;
  if (chainId) {
    return cache.has(buildBurnedKey(null, tokenId));
  }
  return false;
}

export function filterBurnedPosts<T extends { tokenId: string; chainId?: string }>(posts: T[]): T[] {
  const cache = loadCache();
  if (cache.size === 0) return posts;
  return posts.filter((p) => !cache.has(buildBurnedKey(p.chainId, p.tokenId)));
}
