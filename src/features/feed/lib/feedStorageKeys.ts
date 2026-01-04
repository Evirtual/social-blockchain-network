type Scope =
  | { kind: "home" }
  | { kind: "profile"; address?: string | null };

function normalizeAddressForKey(address?: string | null) {
  const a = typeof address === "string" ? address.trim().toLowerCase() : "";
  return a || null;
}

export function getFeedStorageKeys(scope: Scope) {
  const base = "socialBlockchainNetwork.feed";

  if (scope.kind === "home") {
    return {
      searchQueryKey: `${base}.searchQuery.home`,
      selectedNetworksKey: `${base}.selectedNetworks.home`
    };
  }

  const addr = normalizeAddressForKey(scope.address);
  const suffix = addr ? `profile.${addr}` : "profile";

  return {
    searchQueryKey: `${base}.searchQuery.${suffix}`,
    selectedNetworksKey: `${base}.selectedNetworks.${suffix}`
  };
}
