import { mapWithConcurrency } from "@shared/lib/async";
import type { Post } from "@types";

export async function pruneExistsFallback(args: {
  resolvedChainIdNum: number | null;
  postsSnapshot: Post[];
  postKey: (p: Pick<Post, "tokenId" | "chainId">) => string;
  pruneByKeys: (keys: Set<string>) => void;
  readContract: any;
}) {
  if (args.resolvedChainIdNum == null) return;

  const chainIdStr = String(args.resolvedChainIdNum);
  const chainPosts = args.postsSnapshot.filter((p) => p.chainId === chainIdStr);
  const batchSize = 10;
  const sample = chainPosts.slice(0, batchSize);

  if (sample.length === 0) return;

  const dead = await mapWithConcurrency(sample, 5, async (p) => {
    try {
      const ok = (await (args.readContract as any).exists(BigInt(p.tokenId))) as boolean;
      return ok ? null : p;
    } catch {
      return null;
    }
  });

  const deadKeys = new Set(dead.filter(Boolean).map((p) => args.postKey(p as Post)));
  if (deadKeys.size > 0) args.pruneByKeys(deadKeys);
}
