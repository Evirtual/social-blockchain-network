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
  const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v));
  const parse = options?.parse ?? ((raw: string) => JSON.parse(raw) as T);

  const initial = useMemo(() => {
    if (typeof window === "undefined") {
      return { value: initialValue, hasStoredValue: false };
    }

    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw == null) return { value: initialValue, hasStoredValue: false };
      const parsed = parse(raw);
      if (parsed == null) return { value: initialValue, hasStoredValue: false };
      return { value: parsed, hasStoredValue: true };
    } catch {
      return { value: initialValue, hasStoredValue: false };
    }
  }, [storageKey, initialValue, parse]);

  const [value, setValue] = useState<T>(initial.value);
  const [hasStoredValue, setHasStoredValue] = useState<boolean>(initial.hasStoredValue);

  const setAndPersist = useCallback(
    (next: React.SetStateAction<T>) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(storageKey, serialize(resolved));
            setHasStoredValue(true);
          }
        } catch {
          // ignore write failures
        }
        return resolved;
      });
    },
    [storageKey, serialize]
  );

  return useMemo(() => [value, setAndPersist, hasStoredValue] as const, [value, setAndPersist, hasStoredValue]);
}
