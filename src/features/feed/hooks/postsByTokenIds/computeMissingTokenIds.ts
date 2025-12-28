import type { Post } from "@types";
import { parseChainIdNumber } from "@shared/lib/chainId";

export function computeMissingTokenIds(params: {
  tokenIds: string[];
  currentChainId: number | null;
  postsSnapshot: Post[];
}): string[] {
  const { tokenIds, currentChainId, postsSnapshot } = params;

  const existing = new Set(
    postsSnapshot
      .filter((p) => {
        const pChain = parseChainIdNumber(p.chainId ?? null);
        return currentChainId == null || pChain == null || pChain === currentChainId;
      })
      .map((p) => p.tokenId)
  );

  return Array.from(new Set(tokenIds)).filter((id) => id && !existing.has(id));
}
