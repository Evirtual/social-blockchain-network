import type { Post } from "@types";

export function filterPosts(params: {
  posts: Post[];
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  shortAddress: (address: string) => string;
  searchQuery: string;
  selectedNetworkChainIds: string[];
}): Post[] {
  const { posts, authorIdentity, shortAddress, searchQuery, selectedNetworkChainIds } = params;

  const q = searchQuery.trim().toLowerCase();
  const selectedSet = new Set(selectedNetworkChainIds);

  const byNetwork = selectedSet.size
    ? posts.filter((post) => {
        const id = post.chainId ?? null;
        if (!id) return false;
        return selectedSet.has(String(id));
      })
    : [];

  if (!q) return byNetwork;

  return byNetwork.filter((post) => {
    const author = post.author ?? "";
    const authorKey = author.toLowerCase();
    const identityName = authorKey ? authorIdentity.get(authorKey)?.name ?? "" : "";
    const short = author ? shortAddress(author) : "";

    const base = post.searchText ? [post.searchText] : [post.tokenId, post.title, post.body, author];
    const haystack = [...base, identityName, short].filter(Boolean).join(" ").toLowerCase();

    return haystack.includes(q);
  });
}
