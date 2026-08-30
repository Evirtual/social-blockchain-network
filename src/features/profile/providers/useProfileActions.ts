import { useContext } from "react";
import { requireContext } from "@shared/lib/reactContext";
import { ProfileActionsContext } from "./profileStateContext";

export function useProfileActions() {
  const ctx = useContext(ProfileActionsContext);
  return requireContext(ctx, "useProfileActions", "ProfileProvider");
}
