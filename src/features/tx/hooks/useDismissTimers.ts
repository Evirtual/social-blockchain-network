import { useCallback, useEffect, useRef } from "react";

type DismissTimers = Record<string, number>;

export function useDismissTimers(onDismiss: (hash: string) => void, delayMs = 5000) {
  const dismissTimersRef = useRef<DismissTimers>({});

  const clearDismissTimer = useCallback((hash: string) => {
    const timer = dismissTimersRef.current[hash];
    if (typeof timer !== "number") return;
    window.clearTimeout(timer);
    delete dismissTimersRef.current[hash];
  }, []);

  const scheduleAutoDismiss = useCallback(
    (hash: string) => {
      if (dismissTimersRef.current[hash]) return;
      dismissTimersRef.current[hash] = window.setTimeout(() => {
        onDismiss(hash);
        delete dismissTimersRef.current[hash];
      }, delayMs);
    },
    [delayMs, onDismiss]
  );

  useEffect(() => {
    return () => {
      const timers = dismissTimersRef.current;
      for (const hash of Object.keys(timers)) {
        const timer = timers[hash];
        if (typeof timer === "number") window.clearTimeout(timer);
      }
      dismissTimersRef.current = {};
    };
  }, []);

  return { clearDismissTimer, scheduleAutoDismiss };
}
