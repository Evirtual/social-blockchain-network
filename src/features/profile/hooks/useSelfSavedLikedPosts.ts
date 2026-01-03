import { useMemo } from "react";
import type { Post } from "@types";
import { buildPostsByKey, resolvePostsFromKeys, uniqueByChainTokenKey } from "./utils";

export function useSelfSavedLikedPosts(params: {
  isSelf: boolean;
  walletAddress: string | null;
  feedPosts: Post[];
  savedTokenIdsByAddress: Record<string, string[]>;
  likedTokenIdsByAddress: Record<string, string[]>;
}) {
  const { isSelf, walletAddress, feedPosts, savedTokenIdsByAddress, likedTokenIdsByAddress } = params;

  return useMemo(() => {
    if (!isSelf || !walletAddress) {
      return { savedPosts: [] as Post[], likedPosts: [] as Post[] };
    }

    const selfKey = walletAddress.toLowerCase();

    const postsByKey = buildPostsByKey(feedPosts);

    const savedFromFeed = uniqueByChainTokenKey(feedPosts, (p) => Boolean(p.savedByMe));
    const likedFromFeed = uniqueByChainTokenKey(feedPosts, (p) => Boolean(p.likedByMe));

    const savedKeys = savedTokenIdsByAddress[selfKey] ?? [];
    const likedKeys = likedTokenIdsByAddress[selfKey] ?? [];

    const savedPosts =
      savedKeys.length > 0
        ? resolvePostsFromKeys({ keys: savedKeys, postsByKey, postsFallback: feedPosts })
        : savedFromFeed;

    const likedPosts =
      likedKeys.length > 0
        ? resolvePostsFromKeys({ keys: likedKeys, postsByKey, postsFallback: feedPosts })
        : likedFromFeed;

    return { savedPosts, likedPosts };
  }, [isSelf, walletAddress, feedPosts, savedTokenIdsByAddress, likedTokenIdsByAddress]);
}
