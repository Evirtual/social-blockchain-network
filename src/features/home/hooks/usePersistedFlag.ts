import { useCallback, useState } from "react";

export function usePersistedFlag(storageKey: string) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const setAndPersist = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore write failures (e.g. private browsing)
      }
    },
    [storageKey]
  );

  return [value, setAndPersist] as const;
}
