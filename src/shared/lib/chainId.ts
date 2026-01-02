export function parseChainIdNumber(chainId: string | null): number | null {
  if (!chainId) return null;
  const raw = String(chainId).trim();
  if (!raw) return null;

  const n = raw.startsWith("0x") || raw.startsWith("0X")
    ? Number.parseInt(raw, 16)
    : Number.parseInt(raw, 10);

  return Number.isFinite(n) ? n : null;
}

export function normalizeChainIdToString(chainId: string | number | null | undefined): string | undefined {
  if (chainId == null || chainId === "") return undefined;
  if (typeof chainId === "number") return Number.isFinite(chainId) ? String(chainId) : undefined;
  const n = parseChainIdNumber(chainId);
  return n == null ? undefined : String(n);
}
