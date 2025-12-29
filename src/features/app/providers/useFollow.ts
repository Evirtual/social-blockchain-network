import { useContext } from "react";
import { FollowContext } from "./followStateContext";

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error("useFollow must be used within <FollowProvider>");
  return ctx;
}
