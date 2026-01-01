import { useCallback, useState } from "react";

export function usePersistedFlag(storageKey: string) {
  void storageKey;
  const [value, setValue] = useState<boolean>(false);

  const setAndPersist = useCallback(
    (next: boolean) => {
      setValue(next);
    },
    []
  );

  return [value, setAndPersist] as const;
}
