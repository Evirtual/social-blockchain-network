/**
 * Profiles are per chain, not per address.
 *
 * Each network runs its own SocialPosts deployment and its own subgraph, so one
 * address can hold a different name, bio and avatar on each of them. Caching by
 * address alone collapses those into whichever chain resolved first, which then
 * labels every post by that author - on any network - with the wrong identity.
 *
 * Matches the `chainId:address` convention already used for like/save edges.
 */
export function profileKey(chainId: string | number | null | undefined, address: string): string {
  const chain = String(chainId ?? "").trim().toLowerCase();
  const account = String(address ?? "").trim().toLowerCase();
  return `${chain}:${account}`;
}
