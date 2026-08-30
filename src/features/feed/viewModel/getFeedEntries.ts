import type { Post } from "@types";
import type { PostFeedEntry } from "@features/post/types";
import { getAuthorPresentation } from "./getAuthorPresentation";

export function getFeedEntries(args: {
  posts: Post[];
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  guestHue: number;
  walletLower: string | null;
  isOwner?: boolean;
}): PostFeedEntry[] {
  return args.posts.map((post) => {
    const { authorLabel, authorHue, authorAvatarUrl } = getAuthorPresentation({
      author: post.author,
      chainId: post.chainId,
      authorIdentity: args.authorIdentity,
      guestHue: args.guestHue
    });
    const isMine = !!args.walletLower && !!post.author && args.walletLower === post.author.toLowerCase();
    const canModerate = !!args.isOwner;
    const panelKey = `${post.chainId ?? ""}:${post.tokenId}`;
    const compositeKey = `${panelKey}:${post.contextTag ?? "post"}`;

    return {
      post,
      author: { authorLabel, authorHue, authorAvatarUrl },
      isMine,
      canModerate,
      panelKey,
      compositeKey
    };
  });
}
