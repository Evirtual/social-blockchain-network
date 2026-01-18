import { useCallback, useMemo, useState, type ReactNode } from "react";
import { VideoTrimContext, type VideoTrimContextValue } from "./videoTrimStateContext";
import { type VideoTrimOptions, type VideoTrimSession } from "../types";
import { VideoTrimDialog } from "../components/VideoTrimDialog";

export function VideoTrimProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<VideoTrimSession | null>(null);

  const openVideoTrim = useCallback((options: VideoTrimOptions) => {
    setSession((prev) => {
      if (prev) return prev;
      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...options
      };
    });
  }, []);

  const dialog = useMemo(() => {
    if (!session) return null;
    const handleClose = (reason: "cancel" | "completed") => {
      if (reason === "cancel" && session.onCancel) {
        session.onCancel();
      }
      setSession(null);
    };
    return <VideoTrimDialog key={session.id} session={session} onClose={handleClose} />;
  }, [session]);

  const contextValue = useMemo<VideoTrimContextValue>(() => ({ openVideoTrim }), [openVideoTrim]);

  return (
    <VideoTrimContext.Provider value={contextValue}>
      {children}
      {dialog}
    </VideoTrimContext.Provider>
  );
}
