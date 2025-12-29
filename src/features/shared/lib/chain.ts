import { stableHueFromSeed } from "./format";

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

export function getNetworkBrandHue(chainId: string | null): number {
  const id = Number(chainId);
  // Keep these in sync with `brandHueForChainId` in home/services/supportedNetworks.
  switch (id) {
    case 11155111: // Ethereum Sepolia
    case 1: // Ethereum mainnet
      return 223;
    case 84532: // Base Sepolia
    case 8453: // Base mainnet
      return 220;
    case 97: // BSC Testnet
    case 56: // BSC mainnet
      return 45;
    case 31337: // Local
      return 210;
    default:
      return stableHueFromSeed(`chain:${Number.isFinite(id) ? id : String(chainId ?? "")}`);
  }
}
