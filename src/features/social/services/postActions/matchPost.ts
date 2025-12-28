import type { Post } from "@types";

export function isSamePost(args: {
  post: Post;
  tokenId: string;
  postChainId?: string | null;
}) {
  if (args.post.tokenId !== args.tokenId) return false;
  if (args.postChainId && args.post.chainId && args.post.chainId !== args.postChainId) return false;
  return true;
}
