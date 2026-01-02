import { collectIpfsCidsFromTokenUri } from "./pinataCleanup";
import { mapWithConcurrency } from "@shared/lib/async";
import type { SocialPostsContract } from "@features/contract";

export async function collectPinnedCidsForTokenIds(opts: {
  readContract: SocialPostsContract;
  tokenIds: bigint[];
  concurrency?: number;
}): Promise<Set<string>> {
  const { readContract, tokenIds, concurrency = 4 } = opts;

  const pinnedCids = new Set<string>();
  if (!tokenIds.length) return pinnedCids;

  await mapWithConcurrency(tokenIds, concurrency, async (id) => {
    try {
      const tokenUri = (await readContract.tokenURI(id)) as string;
      const cids = await collectIpfsCidsFromTokenUri(tokenUri);
      for (const cid of cids) pinnedCids.add(cid);
    } catch {
      // ignore
    }
    return null;
  });

  return pinnedCids;
}
