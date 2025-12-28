import type { PostComment } from "@types";

export function mergeComments(prevComments: PostComment[], nextComments: PostComment[]): PostComment[] {
  if (prevComments.length === 0) return nextComments;
  if (nextComments.length === 0) return prevComments;

  const seen = new Set<string>();
  for (const c of prevComments) {
    const sig = `${c.txHash ?? ""}:${c.logIndex ?? -1}`;
    if (c.txHash) seen.add(sig);
  }

  const merged = prevComments.slice();
  for (const c of nextComments) {
    if (c.txHash) {
      const sig = `${c.txHash}:${c.logIndex ?? -1}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
    }
    merged.push(c);
  }

  return merged.sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));
}
