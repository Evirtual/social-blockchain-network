import { useContext } from "react";
import { requireContext } from "@shared/lib/reactContext";
import { FollowContext } from "./followStateContext";

export function useFollow() {
  const ctx = useContext(FollowContext);
  return requireContext(ctx, "useFollow", "FollowProvider");
}
