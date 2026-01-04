import type { Post } from "@types";

export const TOTAL_COUNT_CACHE = new Map<string, number>();
export const AUTHOR_COUNT_CACHE = new Map<string, number>();
export const REMOTE_SEARCH_CACHE = new Map<string, Post[]>();

export function stableIdsKey(ids: string[]) {
  return ids.slice().sort().join(",");
}

export function setCacheWithCap<K, V>(cache: Map<K, V>, key: K, value: V, cap = 50) {
  // Simple capped Map (insertion-order eviction). Good enough to avoid refetch-on-navigation.
  cache.set(key, value);
  if (cache.size <= cap) return;
  const firstKey = cache.keys().next().value as K | undefined;
  if (firstKey !== undefined) cache.delete(firstKey);
}
