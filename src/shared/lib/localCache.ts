import { parseWithBigInt, stringifyWithBigInt } from "./jsonBigInt";

export function readLocalCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return parseWithBigInt<T>(raw);
  } catch {
    return null;
  }
}

export function writeLocalCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, stringifyWithBigInt(value));
  } catch (error) {
    // Quota exhaustion and private-mode restrictions are expected and not worth
    // reporting. Anything else means the cache is silently doing nothing, which
    // is worth knowing during development.
    if (import.meta.env?.DEV && !(error instanceof DOMException)) {
      // eslint-disable-next-line no-console
      console.warn(`localCache: failed to store "${key}"`, error);
    }
  }
}
