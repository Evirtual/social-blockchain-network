import { useCallback, useEffect, useState } from "react";

export function usePersistedFlag(storageKey: string) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  const setAndPersist = useCallback(
    (next: boolean) => {
      setValue(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // Ignore storage errors (quota, disabled, etc.).
      }
    },
    [storageKey]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      setValue(event.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  return [value, setAndPersist] as const;
}
