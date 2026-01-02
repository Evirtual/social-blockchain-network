import { useContext } from "react";
import { requireContext } from "@shared/lib";
import { FeedStateContext } from "./feedStateContext";

export function useFeedState() {
  const ctx = useContext(FeedStateContext);
  return requireContext(ctx, "useFeedState", "FeedProvider");
}
