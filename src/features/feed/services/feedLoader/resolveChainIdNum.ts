import { withTimeout } from "@shared/lib/feedQuery";
import type { ChainProvider } from "@features/contract";

export async function resolveChainIdNum(args: { chainIdNum: number | null; networkProvider: ChainProvider }) {
  let resolvedChainIdNum: number | null = args.chainIdNum;
  if (resolvedChainIdNum == null && typeof args.networkProvider?.getNetwork === "function") {
    try {
      const net = await withTimeout(args.networkProvider.getNetwork(), 3_000, "feed getNetwork");
      const n = Number(net?.chainId);
      resolvedChainIdNum = Number.isFinite(n) ? n : null;
    } catch {
      resolvedChainIdNum = null;
    }
  }
  return resolvedChainIdNum;
}
