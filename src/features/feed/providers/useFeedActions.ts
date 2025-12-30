import { useContext } from "react";
import { FeedActionsContext } from "./feedStateContext";

export function useFeedActions() {
  const ctx = useContext(FeedActionsContext);
  if (!ctx) throw new Error("useFeedActions must be used within <FeedProvider>");
  return ctx;
}
