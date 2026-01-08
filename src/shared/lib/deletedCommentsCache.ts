import { readSessionCache, writeSessionCache } from "./sessionCache";
import { parseChainKey } from "./chainKey";

type CacheShape = {
  keys: string[];
  ts: number;
};

const CACHE_KEY = "socialBlockchainNetwork.deletedComments";
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

export function buildDeletedCommentKey(chainId: string | null | undefined, tokenId: string, commentId: string) {
  const chainKey = parseChainKey(chainId ?? null);
  const base = `${tokenId}:${commentId}`;
  return chainKey ? `${chainKey}:${base}` : base;
}

export function markCommentDeleted(chainId: string | null | undefined, tokenId: string, commentId: string) {
  const key = buildDeletedCommentKey(chainId, tokenId, commentId);
  const next = loadCache();
  next.add(key);
  persistCache(next);
}

export function isCommentDeleted(chainId: string | null | undefined, tokenId: string, commentId: string) {
  const cache = loadCache();
  const key = buildDeletedCommentKey(chainId, tokenId, commentId);
  if (cache.has(key)) return true;
  if (chainId) {
    const fallback = buildDeletedCommentKey(null, tokenId, commentId);
    return cache.has(fallback);
  }
  return false;
}
