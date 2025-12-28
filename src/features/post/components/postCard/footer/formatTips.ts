import { formatEther } from "ethers";

export function formatTipsWei(params: { tipsWei: bigint; nativeSymbol: string }): string {
  const { tipsWei, nativeSymbol } = params;
  return `${Number(formatEther(tipsWei)).toFixed(6)} ${nativeSymbol}`;
}
