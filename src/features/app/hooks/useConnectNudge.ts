import { useCallback, useEffect, useRef, useState } from "react";
import { CONNECT_NUDGE_EVENT_NAME } from "@shared/lib/connectNudge";

export function useConnectNudge() {
  const [connectNudge, setConnectNudge] = useState(false);
  const connectNudgeTimeoutRef = useRef<number | null>(null);

  const triggerConnectNudge = useCallback(() => {
    setConnectNudge(true);
    if (connectNudgeTimeoutRef.current !== null) {
      window.clearTimeout(connectNudgeTimeoutRef.current);
    }
    connectNudgeTimeoutRef.current = window.setTimeout(() => {
      setConnectNudge(false);
      connectNudgeTimeoutRef.current = null;
    }, 1400);
  }, []);

  useEffect(() => {
    const handleNudge = () => triggerConnectNudge();
    window.addEventListener(CONNECT_NUDGE_EVENT_NAME, handleNudge);
    return () => {
      window.removeEventListener(CONNECT_NUDGE_EVENT_NAME, handleNudge);
      if (connectNudgeTimeoutRef.current !== null) {
        window.clearTimeout(connectNudgeTimeoutRef.current);
        connectNudgeTimeoutRef.current = null;
      }
    };
  }, [triggerConnectNudge]);

  return { connectNudge, triggerConnectNudge };
}
