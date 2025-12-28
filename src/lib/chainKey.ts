export function parseChainKey(chainId: string | null): string {
  const chainRaw = String(chainId ?? "").trim();
  if (!chainRaw) return "";
  const chainNum = chainRaw.startsWith("0x") || chainRaw.startsWith("0X")
    ? Number.parseInt(chainRaw, 16)
    : Number.parseInt(chainRaw, 10);
  return Number.isFinite(chainNum) ? String(chainNum) : chainRaw;
}
