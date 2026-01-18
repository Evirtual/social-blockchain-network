import { clamp } from "@shared/lib/math";

export function mapTrimRatioToUiProgress(ratio: number) {
  // UI behavior: never show 100% until we have the output bytes.
  return clamp(0.2 + clamp(ratio, 0, 1) * 0.75, 0, 0.95);
}

