import { useContext } from "react";
import { VideoTrimContext } from "../providers/videoTrimStateContext";

export function useVideoTrim() {
  const context = useContext(VideoTrimContext);
  if (!context) {
    throw new Error("useVideoTrim must be used within a VideoTrimProvider");
  }
  return context;
}
