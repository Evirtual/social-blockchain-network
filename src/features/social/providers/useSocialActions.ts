import { useContext } from "react";
import { requireContext } from "@shared/lib";
import { SocialActionsContext } from "./socialActionsStateContext";

export function useSocialActions() {
  const ctx = useContext(SocialActionsContext);
  return requireContext(ctx, "useSocialActions", "SocialActionsProvider");
}
