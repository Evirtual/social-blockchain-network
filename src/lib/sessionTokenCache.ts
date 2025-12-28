export function makeSessionTokenCacheKey(prefix: string, addressLower: string) {
  const addr = String(addressLower ?? "").trim().toLowerCase();
  if (!addr) return null;
  return `${prefix}${addr}`;
}

export function readSessionTokenIds(prefix: string, addressLower: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const storageKey = makeSessionTokenCacheKey(prefix, addressLower);
    if (!storageKey) return null;
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const tokenIds = Array.isArray(parsed?.tokenIds)
      ? parsed.tokenIds
          .filter((x: unknown) => typeof x === "string" && x.trim())
          .map((x: string) => x.trim())
      : [];
    return tokenIds;
  } catch {
    return null;
  }
}

export function writeSessionTokenIds(prefix: string, addressLower: string, tokenIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    const storageKey = makeSessionTokenCacheKey(prefix, addressLower);
    if (!storageKey) return;
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        tokenIds: tokenIds
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => x.trim())
      })
    );
  } catch {
    // ignore
  }
}
