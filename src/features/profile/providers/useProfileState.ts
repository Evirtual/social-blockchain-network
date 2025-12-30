import { useContext } from "react";
import { ProfileStateContext } from "./profileStateContext";

export function useProfileState() {
  const ctx = useContext(ProfileStateContext);
  if (!ctx) throw new Error("useProfileState must be used within <ProfileProvider>");
  return ctx;
}
