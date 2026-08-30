import { useEffect, useMemo } from "react";
import type { Post } from "@types";
import { profileKey } from "../lib/profileKey";

export function usePrefetchMissingAuthorProfiles(
  enabled: boolean,
  posts: Post[],
  profilesByAddress: Record<string, { name: string; bio: string; avatarUrl: string }>,
  loadProfile: (address: string, chainIdOverride?: string | null) => Promise<void>,
  concurrencyLimit = 4
) {
  // Each author is looked up against the chain its post came from. Resolving
  // them all against the connected wallet's chain queries the wrong subgraph
  // for posts from any other network, and finds nothing when no wallet is
  // connected at all.
  const missingAuthors = useMemo(() => {
    // Deduplicated by author *and* chain: one author appearing on three
    // networks needs three lookups, since each carries its own profile.
    const wanted = new Map<string, { author: string; chainId: string | undefined }>();
    for (const post of posts) {
      const author = post.author ? post.author.toLowerCase() : "";
      if (!author) continue;
      const key = profileKey(post.chainId, author);
      if (wanted.has(key) || profilesByAddress[key]) continue;
      wanted.set(key, { author, chainId: post.chainId });
    }

    return Array.from(wanted.values());
  }, [posts, profilesByAddress]);

  useEffect(() => {
    if (!enabled) return;
    if (missingAuthors.length === 0) return;

    const task = async () => {
      const limit = Math.max(1, Math.min(concurrencyLimit, missingAuthors.length));
      let next = 0;

      const workers = Array.from({ length: limit }, async () => {
        while (true) {
          const i = next++;
          if (i >= missingAuthors.length) break;
          const entry = missingAuthors[i];
          if (entry) await loadProfile(entry.author, entry.chainId);
        }
      });

      await Promise.all(workers);
    };

    void task();
  }, [enabled, missingAuthors, loadProfile, concurrencyLimit]);
}
