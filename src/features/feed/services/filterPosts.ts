import type { Post } from "@types";
import { shortAddress } from "@shared/lib/format";

export function filterPosts(params: {
  posts: Post[];
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  searchQuery: string;
  selectedNetworkChainIds: string[];
}): Post[] {
  const { posts, authorIdentity, searchQuery, selectedNetworkChainIds } = params;

  const selectedSet = new Set(selectedNetworkChainIds);

  const byNetwork = selectedSet.size
    ? posts.filter((post) => {
        const id = post.chainId ?? null;
        if (!id) return false;
        return selectedSet.has(String(id));
      })
    : [];

  const trimmedQuery = searchQuery.trim();
  const q = trimmedQuery.toLowerCase();
  if (q.length < 3) return byNetwork;
  if (!q) return byNetwork;

  return byNetwork.filter((post) => {
    const author = post.author ?? "";
    const authorKey = author.toLowerCase();
    const identityName = authorKey ? authorIdentity.get(authorKey)?.name ?? "" : "";
    const short = author ? shortAddress(author) : "";

    const haystack = [post.body ?? "", author, identityName, short].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
