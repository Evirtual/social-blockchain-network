import { useMemo } from "react";
import type { Post } from "@types";
import { stableHueFromSeed } from "@shared/lib/formatters";
import { profileKey, type ProfileKey } from "../lib/profileKey";

export type AuthorIdentity = { name: string; hue: number; avatarUrl?: string };

/**
 * Keyed by `chainId:address`, because one address can hold a different profile
 * on each network. The hue stays derived from the address alone, so an author
 * keeps a consistent colour across chains even when their name differs.
 */
export function useAuthorIdentity(
  posts: Post[],
  profilesByAddress: Record<ProfileKey, { name: string; bio: string; avatarUrl: string }>
) {
  return useMemo(() => {
    const map = new Map<string, AuthorIdentity>();

    for (const post of posts) {
      if (!post.author) continue;
      const account = post.author.toLowerCase();
      const key = profileKey(post.chainId, account);
      if (map.has(key)) continue;

      const profile = profilesByAddress[key];
      const name = profile?.name ?? "";
      const avatarUrl = profile?.avatarUrl?.trim() ? profile.avatarUrl : undefined;
      map.set(key, { name, hue: stableHueFromSeed(account), avatarUrl });
    }

    return map;
  }, [posts, profilesByAddress]);
}
