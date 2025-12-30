import { useContext } from "react";
import { FeedStateContext } from "./feedStateContext";

export function useFeedState() {
  const ctx = useContext(FeedStateContext);
  if (!ctx) throw new Error("useFeedState must be used within <FeedProvider>");
  return ctx;
}
