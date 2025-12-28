import { withTimeout } from "@shared/lib/feedQuery";

export async function resolveChainIdNum(args: { chainIdNum: number | null; networkProvider: any }) {
  let resolvedChainIdNum: number | null = args.chainIdNum;
  if (resolvedChainIdNum == null && typeof args.networkProvider?.getNetwork === "function") {
    try {
      const net = await withTimeout(args.networkProvider.getNetwork(), 3_000, "feed getNetwork");
      const n = Number((net as any)?.chainId);
      resolvedChainIdNum = Number.isFinite(n) ? n : null;
    } catch {
      resolvedChainIdNum = null;
    }
  }
  return resolvedChainIdNum;
}
