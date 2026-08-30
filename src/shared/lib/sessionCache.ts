import { parseWithBigInt, stringifyWithBigInt } from "./jsonBigInt";

export function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return parseWithBigInt<T>(raw);
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, stringifyWithBigInt(value));
  } catch (error) {
    // See localCache: quota and private-mode failures are expected, anything
    // else means the cache is silently inert.
    if (import.meta.env?.DEV && !(error instanceof DOMException)) {
      // eslint-disable-next-line no-console
      console.warn(`sessionCache: failed to store "${key}"`, error);
    }
  }
}
