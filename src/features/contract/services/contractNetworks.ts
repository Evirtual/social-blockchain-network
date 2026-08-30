export type ContractNetworkConfig = {
  chainId: number;
  contractAddress: string;
  rpcUrl?: string;
};

import type { EnvMap } from "@shared/lib/env";

export function getConfiguredContractNetworks(env: EnvMap): ContractNetworkConfig[] {
  const configuredNetworks: ContractNetworkConfig[] = [
    { chainId: 1, contractAddress: env.VITE_CONTRACT_ADDRESS_ETH, rpcUrl: env.VITE_ETH_RPC_URL },
    { chainId: 11155111, contractAddress: env.VITE_CONTRACT_ADDRESS_SEPOLIA, rpcUrl: env.VITE_ETH_SEPOLIA_RPC_URL },
    { chainId: 8453, contractAddress: env.VITE_CONTRACT_ADDRESS_BASE, rpcUrl: env.VITE_BASE_RPC_URL },
    { chainId: 84532, contractAddress: env.VITE_CONTRACT_ADDRESS_BASE_SEPOLIA, rpcUrl: env.VITE_BASE_SEPOLIA_RPC_URL },
    { chainId: 56, contractAddress: env.VITE_CONTRACT_ADDRESS_BSC, rpcUrl: env.VITE_BSC_RPC_URL },
    { chainId: 97, contractAddress: env.VITE_CONTRACT_ADDRESS_BSC_TESTNET, rpcUrl: env.VITE_BSC_TESTNET_RPC_URL },
    {
      chainId: 31337,
      contractAddress: env.VITE_CONTRACT_ADDRESS_LOCAL,
      rpcUrl: env.VITE_LOCAL_RPC_URL
    }
  ]
    .filter((n) => typeof n.contractAddress === "string" && n.contractAddress.trim().length > 0)
    .map((n) => ({ ...n, contractAddress: String(n.contractAddress).trim() }));

  return configuredNetworks;
}
