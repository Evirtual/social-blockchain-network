import { useCallback } from "react";

import type { Post } from "@types";
import { bestEffortUnpinCids, collectReferencedIpfsCidsFromPosts } from "@features/ipfs";

export function useBestEffortUnpinCidsSafe(args: { ipfsConfigured: boolean; posts: Post[] }) {
  const { ipfsConfigured, posts } = args;

  return useCallback(
    async (cids: Iterable<string>, exclude?: { chainId?: string | null; tokenIds?: Iterable<string> }) => {
      if (!ipfsConfigured) return;
      const protect = collectReferencedIpfsCidsFromPosts(posts, { exclude });
      await bestEffortUnpinCids(cids, { protectReferencedIn: protect });
    },
    [ipfsConfigured, posts]
  );
}
