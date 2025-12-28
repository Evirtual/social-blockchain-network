import type { Post } from "@types";

export function normalizeChainIdForKey(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const n = s.startsWith("0x") || s.startsWith("0X") ? Number.parseInt(s, 16) : Number.parseInt(s, 10);
  return Number.isFinite(n) ? String(n) : s;
}

export function buildPostsByKey(posts: Post[]) {
  return new Map(
    posts.map((p) => {
      const k = `${normalizeChainIdForKey(p.chainId ?? null)}:${p.tokenId}`;
      return [k, p] as const;
    })
  );
}

export function uniqueByChainTokenKey(posts: Post[], predicate: (p: Post) => boolean) {
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const p of posts) {
    if (!predicate(p)) continue;
    const k = `${normalizeChainIdForKey(p.chainId ?? null)}:${p.tokenId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

export function resolvePostsFromKeys(params: {
  keys: string[];
  postsByKey: Map<string, Post>;
  postsFallback: Post[];
}) {
  const { keys, postsByKey, postsFallback } = params;
  return keys
    .map((rawKey) => {
      if (rawKey.includes(":")) {
        const [chainPart, tokenId] = rawKey.split(":");
        const normalized = `${normalizeChainIdForKey(chainPart)}:${tokenId}`;
        return postsByKey.get(normalized) ?? postsFallback.find((p) => p.tokenId === tokenId);
      }
      return postsFallback.find((p) => p.tokenId === rawKey);
    })
    .filter((p): p is Post => !!p);
}
