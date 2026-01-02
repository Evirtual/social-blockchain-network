import { JsonRpcProvider } from "ethers";
import { parseChainIdNumber } from "./chainId";

export function getRpcProvider(url: string, chainIdNum: number): JsonRpcProvider {
  return new JsonRpcProvider(url, chainIdNum);
}

export { parseChainIdNumber };

import type { EnvMap } from "./env";

export function getRpcUrlForChainId(env: EnvMap, chainIdNum: number | null): string {
  if (chainIdNum == null) return "";

  const rpcUrlByChainId: Record<number, string | undefined> = {
    1: env?.VITE_ETH_RPC_URL,
    11155111: env?.VITE_ETH_SEPOLIA_RPC_URL,
    8453: env?.VITE_BASE_RPC_URL,
    84532: env?.VITE_BASE_SEPOLIA_RPC_URL,
    56: env?.VITE_BSC_RPC_URL,
    97: env?.VITE_BSC_TESTNET_RPC_URL,
    31337: env?.VITE_LOCAL_RPC_URL
  };

  const v = rpcUrlByChainId[chainIdNum];
  return typeof v === "string" ? v.trim() : "";
}
