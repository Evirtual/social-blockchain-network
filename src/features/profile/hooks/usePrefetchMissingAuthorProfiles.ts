import { useEffect, useMemo } from "react";
import type { Post } from "@types";

export function usePrefetchMissingAuthorProfiles(
  enabled: boolean,
  posts: Post[],
  profilesByAddress: Record<string, { name: string; bio: string; avatarUrl: string }>,
  loadProfile: (address: string) => Promise<void>,
  concurrencyLimit = 4
) {
  const missingAuthors = useMemo(() => {
    const uniqueAuthors = Array.from(new Set(posts.map((p) => (p.author ? p.author.toLowerCase() : "")).filter(Boolean)));

    if (uniqueAuthors.length === 0) return [];
    return uniqueAuthors.filter((a) => !profilesByAddress[a]);
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
          await loadProfile(missingAuthors[i]);
        }
      });

      await Promise.all(workers);
    };

    void task();
  }, [enabled, missingAuthors, loadProfile, concurrencyLimit]);
}
