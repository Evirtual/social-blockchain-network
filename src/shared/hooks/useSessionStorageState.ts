import { useCallback, useMemo, useState } from "react";

type Options<T> = {
  serialize?: (value: T) => string;
  parse?: (raw: string) => T | null;
};

export function useSessionStorageState<T>(
  storageKey: string,
  initialValue: T,
  options?: Options<T>
) {
  const serialize = options?.serialize ?? ((value: T) => JSON.stringify(value));
  const parse = options?.parse ?? ((raw: string) => JSON.parse(raw) as T);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw == null) return initialValue;
      const parsed = parse(raw);
      return parsed == null ? initialValue : parsed;
    } catch {
      return initialValue;
    }
  });
  const [hasStoredValue, setHasStoredValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(storageKey) != null;
    } catch {
      return false;
    }
  });

  const setAndPersist = useCallback(
    (next: React.SetStateAction<T>) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(storageKey, serialize(resolved));
            setHasStoredValue(true);
          } catch {
            // Ignore storage errors (quota, disabled, etc.).
          }
        }
        return resolved;
      });
    },
    [serialize, storageKey]
  );

  return useMemo(() => [value, setAndPersist, hasStoredValue] as const, [value, setAndPersist, hasStoredValue]);
}
