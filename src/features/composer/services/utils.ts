import { parseChainIdNumber } from "@shared/lib/chainId";
export { makeLocalNoticeId } from "@shared/lib/ids";
export { sleep } from "@shared/lib/time";

export function normalizeChainIdToString(chainId: string | number | null | undefined): string | undefined {
  if (chainId == null || chainId === "") return undefined;
  if (typeof chainId === "number") return Number.isFinite(chainId) ? String(chainId) : undefined;
  const n = parseChainIdNumber(chainId);
  return n == null ? undefined : String(n);
}


