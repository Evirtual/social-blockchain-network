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

    const savedFromFeed = uniqueByChainTokenKey(feedPosts, (p) => Boolean((p as any).savedByMe));
    const likedFromFeed = uniqueByChainTokenKey(feedPosts, (p) => Boolean((p as any).likedByMe));

    const savedKeys = savedTokenIdsByAddress[selfKey] ?? [];
    const likedKeys = likedTokenIdsByAddress[selfKey] ?? [];

    const savedPosts =
      savedFromFeed.length > 0
        ? savedFromFeed
        : resolvePostsFromKeys({ keys: savedKeys, postsByKey, postsFallback: feedPosts });

    const likedPosts =
      likedFromFeed.length > 0
        ? likedFromFeed
        : resolvePostsFromKeys({ keys: likedKeys, postsByKey, postsFallback: feedPosts });

    return { savedPosts, likedPosts };
  }, [isSelf, walletAddress, feedPosts, savedTokenIdsByAddress, likedTokenIdsByAddress]);
}
