import { createContext } from "react";
import { createStableContext } from "@shared/lib/createStableContext";
import type { VideoTrimOptions } from "../types";

export type VideoTrimContextValue = {
  openVideoTrim: (options: VideoTrimOptions) => void;
};

export const VideoTrimContext = createStableContext("__sbnetVideoTrimContext", () =>
  createContext<VideoTrimContextValue | null>(null)
);
