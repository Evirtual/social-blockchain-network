import { useMemo } from "react";

export function useHasAnyReadOnlyRpc() {
  return useMemo(() => {
    const env = import.meta.env as any;
    return [
      env.VITE_ETH_RPC_URL,
      env.VITE_ETH_SEPOLIA_RPC_URL,
      env.VITE_BASE_RPC_URL,
      env.VITE_BASE_SEPOLIA_RPC_URL,
      env.VITE_BSC_RPC_URL,
      env.VITE_BSC_TESTNET_RPC_URL,
      env.VITE_LOCAL_RPC_URL
    ].some((v) => typeof v === "string" && v.trim().length > 0);
  }, []);
}
