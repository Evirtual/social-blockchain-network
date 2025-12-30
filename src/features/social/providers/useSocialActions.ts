import { useContext } from "react";
import { SocialActionsContext } from "./socialActionsStateContext";

export function useSocialActions() {
  const ctx = useContext(SocialActionsContext);
  if (!ctx) throw new Error("useSocialActions must be used within <SocialActionsProvider>");
  return ctx;
}
