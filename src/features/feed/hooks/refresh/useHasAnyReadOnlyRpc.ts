import { useMemo } from "react";
import { getEnv } from "@shared/lib/env";

export function useHasAnyReadOnlyRpc() {
  return useMemo(() => {
    const env = getEnv();
    return [
      env.VITE_ETH_RPC_URL,
      env.VITE_ETH_RPC_WS_URL,
      env.VITE_ETH_SEPOLIA_RPC_URL,
      env.VITE_ETH_SEPOLIA_RPC_WS_URL,
      env.VITE_BASE_RPC_URL,
      env.VITE_BASE_RPC_WS_URL,
      env.VITE_BASE_SEPOLIA_RPC_URL,
      env.VITE_BASE_SEPOLIA_RPC_WS_URL,
      env.VITE_BSC_RPC_URL,
      env.VITE_BSC_RPC_WS_URL,
      env.VITE_BSC_TESTNET_RPC_URL,
      env.VITE_BSC_TESTNET_RPC_WS_URL,
      env.VITE_LOCAL_RPC_URL,
      env.VITE_LOCAL_RPC_WS_URL,
      env.VITE_ETH_SUBGRAPH_URL,
      env.VITE_ETH_SEPOLIA_SUBGRAPH_URL,
      env.VITE_BASE_SUBGRAPH_URL,
      env.VITE_BASE_SEPOLIA_SUBGRAPH_URL,
      env.VITE_BSC_SUBGRAPH_URL,
      env.VITE_BSC_TESTNET_SUBGRAPH_URL
    ].some((v) => typeof v === "string" && v.trim().length > 0);
  }, []);
}
