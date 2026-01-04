import { stableHueFromSeed } from "@shared/lib/formatters";
import { getEnv } from "@shared/lib/env";
import { getConfiguredFeedNetworks } from "./feedNetworks";

export type SupportedNetwork = {
  chainId: number;
  chainName: string;
  networkName: string;
  displayName: string;
  description: string;
  brandHue: number;
};

function brandHueForChainId(chainId: number, chainName: string): number {
  // Prefer fixed hues for common chains so icons match official branding.
  // Values are derived from the commonly used brand colors:
  // - Ethereum: #627EEA
  // - Base: #0052FF
  // - BNB Chain: #F0B90B
  // Fallback stays deterministic for unknown chains.
  switch (chainId) {
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
      return stableHueFromSeed(`${chainName}:${chainId}`);
  }
}

function mk(args: { chainId: number; chainName: string; networkName: string; description?: string }): SupportedNetwork {
  const displayName = args.networkName ? `${args.chainName} ${args.networkName}` : args.chainName;
  return {
    chainId: args.chainId,
    chainName: args.chainName,
    networkName: args.networkName,
    displayName,
    description: args.description ?? "",
    brandHue: brandHueForChainId(args.chainId, args.chainName)
  };
}

export function getSupportedNetworks(): SupportedNetwork[] {
  // UX requirement: show supported networks as pills with logo + name.
  // Important: only show networks that actually have a configured contract address.
  const candidates: SupportedNetwork[] = [
    mk({ chainId: 31337, chainName: "Local", networkName: "" }),
    mk({ chainId: 84532, chainName: "Base", networkName: "Sepolia" }),
    mk({ chainId: 11155111, chainName: "Ethereum", networkName: "Sepolia" }),
    mk({ chainId: 97, chainName: "BSC", networkName: "Testnet" })
  ];

  const env = getEnv();
  const configuredChainIds = new Set(getConfiguredFeedNetworks(env).map((n) => n.chainId));
  return candidates.filter((n) => configuredChainIds.has(n.chainId));
}
