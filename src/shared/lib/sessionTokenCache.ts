export function makeSessionTokenCacheKey(prefix: string, addressLower: string) {
  const addr = String(addressLower ?? "").trim().toLowerCase();
  if (!addr) return null;
  return `${prefix}${addr}`;
}

export function readSessionTokenIds(prefix: string, addressLower: string): string[] | null {
  try {
    void prefix;
    void addressLower;
    return null;
  } catch {
    return null;
  }
}

export function writeSessionTokenIds(prefix: string, addressLower: string, tokenIds: string[]) {
  try {
    void prefix;
    void addressLower;
    void tokenIds;
  } catch {
    // ignore
  }
}
