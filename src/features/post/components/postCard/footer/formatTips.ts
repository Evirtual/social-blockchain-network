import { formatEther } from "ethers";

export function formatTipsWei(params: { tipsWei: bigint; nativeSymbol: string }): string {
  const { tipsWei, nativeSymbol } = params;
  if (!tipsWei || tipsWei === 0n) return `0.00 ${nativeSymbol}`;

  // formatEther is exact (no rounding). Trim trailing zeros for readability.
  const raw = formatEther(tipsWei);
  const trimmed = raw.includes(".") ? raw.replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1") : raw;
  return `${trimmed} ${nativeSymbol}`;
}
