export function getExplorerTxUrl(chainId: string | null, txHash: string) {
  if (!chainId) return null;
  const id = Number(chainId);

  // IMPORTANT: Use `import.meta.env` directly so Vite can inject env values.
  // Avoid indirect access like `(import.meta as any).env` which won't be transformed.
  const env = import.meta.env as unknown as Record<string, unknown>;
  const baseKey = `VITE_EXPLORER_BASE_URL_${id}`;
  const envBase = env[baseKey] as string | undefined;
  if (typeof envBase === "string" && envBase.trim()) {
    const base = envBase.trim().replace(/\/+$/, "");
    return `${base}/tx/${txHash}`;
  }

  return null;
}

export function getNativeSymbol(chainId: string | null) {
  const id = Number(chainId);
  if (id === 56 || id === 97) return "BNB";
  return "ETH";
}

export function getNetworkBadgeLabel(chainId: string | null) {
  const id = Number(chainId);
  if (id === 1) return "ETH";
  if (id === 11155111) return "eth-test";
  if (id === 8453) return "BASE";
  if (id === 84532) return "base-test";
  if (id === 56) return "BSC";
  if (id === 97) return "bsc-test";
  return chainId ? `#${id}` : "";
}
