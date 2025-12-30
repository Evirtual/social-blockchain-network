import { useContext } from "react";
import { ComposerContext } from "./composerStateContext";

export function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error("useComposer must be used within <ComposerProvider>");
  return ctx;
}
