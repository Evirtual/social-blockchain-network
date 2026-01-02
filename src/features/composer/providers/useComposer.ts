import { useContext } from "react";
import { requireContext } from "@shared/lib";
import { ComposerContext } from "./composerStateContext";

export function useComposer() {
  const ctx = useContext(ComposerContext);
  return requireContext(ctx, "useComposer", "ComposerProvider");
}
