import { useContext } from "react";
import { requireContext } from "@shared/lib";
import { FeedActionsContext } from "./feedStateContext";

export function useFeedActions() {
  const ctx = useContext(FeedActionsContext);
  return requireContext(ctx, "useFeedActions", "FeedProvider");
}
