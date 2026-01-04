import { useCallback, useEffect, useRef, useState } from "react";
import { COMPOSE_NUDGE_EVENT_NAME } from "@shared/lib/composeNudge";

export function useComposeNudge() {
  const [composeNudge, setComposeNudge] = useState(false);
  const composeNudgeTimeoutRef = useRef<number | null>(null);

  const triggerComposeNudge = useCallback(() => {
    setComposeNudge(true);
    if (composeNudgeTimeoutRef.current !== null) {
      window.clearTimeout(composeNudgeTimeoutRef.current);
    }
    composeNudgeTimeoutRef.current = window.setTimeout(() => {
      setComposeNudge(false);
      composeNudgeTimeoutRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    const handleNudge = () => triggerComposeNudge();
    window.addEventListener(COMPOSE_NUDGE_EVENT_NAME, handleNudge);
    return () => {
      window.removeEventListener(COMPOSE_NUDGE_EVENT_NAME, handleNudge);
      if (composeNudgeTimeoutRef.current !== null) {
        window.clearTimeout(composeNudgeTimeoutRef.current);
        composeNudgeTimeoutRef.current = null;
      }
    };
  }, [triggerComposeNudge]);

  return { composeNudge, triggerComposeNudge };
}
