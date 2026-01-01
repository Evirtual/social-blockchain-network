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
  void storageKey;
  void options;

  const [value, setValue] = useState<T>(initialValue);
  const [hasStoredValue] = useState<boolean>(false);

  const setAndPersist = useCallback(
    (next: React.SetStateAction<T>) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        return resolved;
      });
    },
    []
  );

  return useMemo(() => [value, setAndPersist, hasStoredValue] as const, [value, setAndPersist, hasStoredValue]);
}
