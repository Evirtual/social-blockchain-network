import type { Post } from "../types";

function arePostsEquivalent(a: Post, b: Post): boolean {
  // Intentionally ignore `contextTag` (page-level UI state).
  return (
    a.tokenId === b.tokenId &&
    (a.chainId ?? "") === (b.chainId ?? "") &&
    a.title === b.title &&
    a.body === b.body &&
    a.image === b.image &&
    (a.animationUrl ?? "") === (b.animationUrl ?? "") &&
    a.metadataURI === b.metadataURI &&
    (a.author ?? "") === (b.author ?? "") &&
    (a.mintTxHash ?? "") === (b.mintTxHash ?? "") &&
    (a.mintBlockNumber ?? 0) === (b.mintBlockNumber ?? 0) &&
    (a.mintTimestamp ?? 0) === (b.mintTimestamp ?? 0) &&
    a.likes === b.likes &&
    a.comments === b.comments &&
    a.saves === b.saves &&
    a.tipsWei === b.tipsWei &&
    (a.likedByMe ?? false) === (b.likedByMe ?? false) &&
    (a.savedByMe ?? false) === (b.savedByMe ?? false)
  );
}

export function sortPostsNewestFirst(items: Post[], postKey: (p: Pick<Post, "tokenId" | "chainId">) => string) {
  items.sort((a, b) => {
    const at = a.mintTimestamp ?? 0;
    const bt = b.mintTimestamp ?? 0;
    if (at !== bt) return bt - at;

    const ab = a.mintBlockNumber ?? 0;
    const bb = b.mintBlockNumber ?? 0;
    if (ab !== bb) return bb - ab;

    return postKey(b).localeCompare(postKey(a));
  });
}

export function mergePosts(
  prev: Post[],
  incoming: Post[],
  postKey: (p: Pick<Post, "tokenId" | "chainId">) => string
): Post[] {
  if (!incoming.length) return prev;

  const byKey = new Map(prev.map((p) => [postKey(p), p] as const));
  let anyChange = false;
  for (const p of incoming) {
    const key = postKey(p);
    const existing = byKey.get(key);
    if (existing && arePostsEquivalent(existing, p)) continue;
    byKey.set(key, p);
    anyChange = true;
  }

  // If nothing changed (and we didn't add any new keys), keep the original array reference.
  if (!anyChange && byKey.size === prev.length) return prev;

  const merged = Array.from(byKey.values());
  sortPostsNewestFirst(merged, postKey);

  // Keep the original array reference when ordering and item identities are unchanged.
  if (merged.length === prev.length && merged.every((p, idx) => p === prev[idx])) return prev;
  return merged;
}
