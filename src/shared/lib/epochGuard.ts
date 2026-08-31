import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Invalidates in-flight async work when the thing it was fetched for changes:
 * a chain switch, a wallet switch, a filter change.
 *
 * Work that finds itself stale must not write its results, and by the same rule
 * it must not clear its own loading state either, because a newer request may
 * have set it. That leaves the bump responsible for clearing it - and a bump
 * lives in an effect far away from the `finally` that declined to. Forgetting
 * the link strands a spinner on screen for good, with no error and nothing
 * retrying, which is exactly what happened twice: once in the follow scans and
 * once in the feed.
 *
 * So loading state owned by a guard is created through it, with
 * `useEpochLoadingFlag` or `useEpochLoadingMap`, and a bump clears it by
 * construction rather than by anyone remembering to.
 */
export type EpochGuard = {
  bumpEpoch: () => void;
  snapshotEpoch: () => number;
  isStale: (epoch: number) => boolean;
  /** Only for the loading-state hooks below; callers should use those instead. */
  registerReset: (reset: () => void) => () => void;
};

export function useEpochGuard(): EpochGuard {
  const epochRef = useRef(0);
  const resetsRef = useRef(new Set<() => void>());

  const bumpEpoch = useCallback(() => {
    epochRef.current += 1;
    for (const reset of resetsRef.current) reset();
  }, []);

  const snapshotEpoch = useCallback(() => epochRef.current, []);

  const isStale = useCallback((epoch: number) => epochRef.current !== epoch, []);

  const registerReset = useCallback((reset: () => void) => {
    const resets = resetsRef.current;
    resets.add(reset);
    return () => {
      resets.delete(reset);
    };
  }, []);

  return useMemo(
    () => ({ bumpEpoch, snapshotEpoch, isStale, registerReset }),
    [bumpEpoch, snapshotEpoch, isStale, registerReset]
  );
}

/** A loading flag the guard clears on every bump. */
export function useEpochLoadingFlag(guard: EpochGuard) {
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => guard.registerReset(() => setIsLoading(false)), [guard]);
  return [isLoading, setIsLoading] as const;
}

/** A per-key loading map the guard clears on every bump. */
export function useEpochLoadingMap(guard: EpochGuard) {
  const [isLoadingByKey, setIsLoadingByKey] = useState<Record<string, boolean>>({});
  useEffect(() => guard.registerReset(() => setIsLoadingByKey({})), [guard]);
  return [isLoadingByKey, setIsLoadingByKey] as const;
}
