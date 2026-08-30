import { useContext } from "react";
import { requireContext } from "@shared/lib/reactContext";
import { ComposerContext } from "./composerStateContext";

export function useComposer() {
  const ctx = useContext(ComposerContext);
  return requireContext(ctx, "useComposer", "ComposerProvider");
}
