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
/**
 * Branded so a plain address cannot be passed where a key belongs.
 *
 * Both are strings, so without this the compiler accepts either in either
 * position - which is exactly how the follow lookup and the avatar hue ended up
 * indexed by the wrong one.
 */
export type ProfileKey = string & { readonly __brand: "ProfileKey" };

export function profileKey(chainId: string | number | null | undefined, address: string): ProfileKey {
  const chain = String(chainId ?? "").trim().toLowerCase();
  const account = String(address ?? "").trim().toLowerCase();
  return `${chain}:${account}` as ProfileKey;
}
