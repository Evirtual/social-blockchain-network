import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  // Keep the latest (possibly inline) functions without forcing a new setter identity each render.
  const serializeRef = useRef(serialize);
  const parseRef = useRef(parse);
  serializeRef.current = serialize;
  parseRef.current = parse;

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

  // If the storage key changes (e.g., per-tab/per-page keys), load the new value once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      const nextHasStored = raw != null;
      setHasStoredValue((prev) => (prev === nextHasStored ? prev : nextHasStored));

      let nextValue = initialValue;
      if (raw != null) {
        const parsed = parseRef.current(raw);
        nextValue = parsed == null ? initialValue : parsed;
      }

      setValue((prev) => (Object.is(prev, nextValue) ? prev : nextValue));
    } catch {
      setHasStoredValue((prev) => (prev === false ? prev : false));
      setValue((prev) => (Object.is(prev, initialValue) ? prev : initialValue));
    }
  }, [storageKey, initialValue]);

  const setAndPersist = useCallback(
    (next: React.SetStateAction<T>) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(storageKey, serializeRef.current(resolved));
            setHasStoredValue(true);
          } catch {
            // Ignore storage errors (quota, disabled, etc.).
          }
        }
        return resolved;
      });
    },
    [storageKey]
  );

  return useMemo(() => [value, setAndPersist, hasStoredValue] as const, [value, setAndPersist, hasStoredValue]);
}
