export function getProfileUrl(profileChainId: string | null | undefined, address: string) {
  const normalized = String(address ?? "").trim();
  if (!normalized) return "/profile";
  return profileChainId ? `/profile/${profileChainId}/${normalized}` : `/profile/${normalized}`;
}
