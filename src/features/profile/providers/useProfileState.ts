import { useContext } from "react";
import { requireContext } from "@shared/lib/reactContext";
import { ProfileStateContext } from "./profileStateContext";

export function useProfileState() {
  const ctx = useContext(ProfileStateContext);
  return requireContext(ctx, "useProfileState", "ProfileProvider");
}
