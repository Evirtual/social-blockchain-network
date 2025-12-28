import { useMemo } from "react";
import type { Post } from "@types";
import { stableHueFromSeed } from "@shared/lib/format";

export type AuthorIdentity = { name: string; hue: number; avatarUrl?: string };

export function useAuthorIdentity(
  posts: Post[],
  profilesByAddress: Record<string, { name: string; bio: string; avatarUrl: string }>
) {
  return useMemo(() => {
    const map = new Map<string, AuthorIdentity>();

    for (const post of posts) {
      if (!post.author) continue;
      const key = post.author.toLowerCase();
      if (map.has(key)) continue;

      const profile = profilesByAddress[key];
      const name = profile?.name ?? "";
      const avatarUrl = profile?.avatarUrl?.trim() ? profile.avatarUrl : undefined;
      map.set(key, { name, hue: stableHueFromSeed(key), avatarUrl });
    }

    return map;
  }, [posts, profilesByAddress]);
}
