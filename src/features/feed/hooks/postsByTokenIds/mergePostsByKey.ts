import type { Post } from "@types";

export function mergePostsByKey(prev: Post[], toAdd: Post[], postKey: (p: Post) => string): Post[] {
  if (toAdd.length === 0) return prev;
  const byId = new Map(prev.map((p) => [postKey(p), p] as const));
  for (const p of toAdd) byId.set(postKey(p), p);
  return Array.from(byId.values());
}
