import { useContext } from "react";
import { ProfileActionsContext } from "./profileStateContext";

export function useProfileActions() {
  const ctx = useContext(ProfileActionsContext);
  if (!ctx) throw new Error("useProfileActions must be used within <ProfileProvider>");
  return ctx;
}
