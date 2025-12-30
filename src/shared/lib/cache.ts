export function setMapWithLimit<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  if (map.size <= maxEntries) return;
  const oldestKey = map.keys().next().value as K | undefined;
  if (oldestKey !== undefined) map.delete(oldestKey);
}

export function pruneMapToSize<K, V>(map: Map<K, V>, maxEntries: number): void {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value as K | undefined;
    if (oldestKey === undefined) return;
    map.delete(oldestKey);
  }
}
