import { useMemo } from "react";
import type { Post } from "@types";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";

export function useProfileDerived(args: { walletAddress: string | null; profileName: string; posts: Post[] }) {
  const { walletAddress, profileName, posts } = args;

  const selfAvatarSeed = walletAddress ? walletAddress.toLowerCase() : "guest";
  const selfAvatarHue = useMemo(() => stableHueFromSeed(selfAvatarSeed), [selfAvatarSeed]);

  const displayName = useMemo(
    () => profileName.trim() || (walletAddress ? shortAddress(walletAddress) : "Guest"),
    [profileName, walletAddress]
  );

  const myPostsCount = useMemo(() => {
    if (!walletAddress) return 0;
    const key = walletAddress.toLowerCase();
    return posts.filter((p) => p.author?.toLowerCase() === key).length;
  }, [posts, walletAddress]);

  const profileLink = walletAddress ? `/profile/${walletAddress}` : null;

  return { selfAvatarHue, displayName, myPostsCount, profileLink };
}
