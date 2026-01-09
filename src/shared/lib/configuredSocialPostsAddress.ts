import type { EnvMap } from "./env";
import { getEnv } from "./env";

export function resolveConfiguredSocialPostsAddress(
  chainIdNumber: number | null,
  env: EnvMap = getEnv()
): string | undefined {
  const byChainId: Record<number, string | undefined> = {
    // Ethereum
    1: env?.VITE_CONTRACT_ADDRESS_ETH,
    11155111: env?.VITE_CONTRACT_ADDRESS_SEPOLIA,

    // Base
    8453: env?.VITE_CONTRACT_ADDRESS_BASE,
    84532: env?.VITE_CONTRACT_ADDRESS_BASE_SEPOLIA,

    // BNB Smart Chain (BSC)
    56: env?.VITE_CONTRACT_ADDRESS_BSC,
    97: env?.VITE_CONTRACT_ADDRESS_BSC_TESTNET,

    // Local (Hardhat)
    31337: env?.VITE_CONTRACT_ADDRESS_LOCAL
  };

  if (typeof chainIdNumber === "number") {
    const mapped = byChainId[chainIdNumber];
    if (typeof mapped === "string" && mapped.trim()) return mapped.trim();
  }

  return undefined;
}
