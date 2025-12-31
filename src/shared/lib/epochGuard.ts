import { useCallback, useRef } from "react";

export function useEpochGuard() {
  const epochRef = useRef(0);

  const bumpEpoch = useCallback(() => {
    epochRef.current += 1;
  }, []);

  const snapshotEpoch = useCallback(() => epochRef.current, []);

  const isStale = useCallback((epoch: number) => epochRef.current !== epoch, []);

  return { epochRef, bumpEpoch, snapshotEpoch, isStale };
}
