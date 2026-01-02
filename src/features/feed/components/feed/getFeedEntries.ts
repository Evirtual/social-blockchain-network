import type { Post } from "@types";
import { getAuthorPresentation } from "./getAuthorPresentation";

export type FeedEntry = {
  post: Post;
  authorLabel: string;
  authorHue: number;
  authorAvatarUrl?: string;
  isMine: boolean;
  canModerate: boolean;
  panelKey: string;
  compositeKey: string;
};

export function getFeedEntries(args: {
  posts: Post[];
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  shortAddress: (address: string) => string;
  guestHue: number;
  walletLower: string | null;
  isOwner?: boolean;
}) {
  return args.posts.map((post) => {
    const { authorLabel, authorHue, authorAvatarUrl } = getAuthorPresentation({
      author: post.author,
      authorIdentity: args.authorIdentity,
      shortAddress: args.shortAddress,
      guestHue: args.guestHue
    });
    const isMine = !!args.walletLower && !!post.author && args.walletLower === post.author.toLowerCase();
    const canModerate = !!args.isOwner;
    const panelKey = `${post.chainId ?? ""}:${post.tokenId}`;
    const compositeKey = `${panelKey}:${post.contextTag ?? "post"}`;

    return {
      post,
      authorLabel,
      authorHue,
      authorAvatarUrl,
      isMine,
      canModerate,
      panelKey,
      compositeKey
    };
  });
}
