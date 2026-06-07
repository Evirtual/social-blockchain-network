import { stableHueFromSeed } from "@shared/lib/formatters";
import { getEnv, getEnvString } from "@shared/lib/env";
import { formatAddEthereumChainId, type AddEthereumChainParameter } from "@shared/lib/networkSwitch";
import { getConfiguredFeedNetworks } from "./feedNetworks";

export type SupportedNetwork = {
  chainId: number;
  chainName: string;
  networkName: string;
  displayName: string;
  description: string;
  brandHue: number;
};

const DEFAULT_RPC_URL_BY_CHAIN_ID: Record<number, string> = {
  31337: "http://127.0.0.1:8545",
  84532: "https://sepolia.base.org",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
  97: "https://data-seed-prebsc-1-s1.bnbchain.org:8545"
};

const DEFAULT_EXPLORER_URL_BY_CHAIN_ID: Record<number, string> = {
  84532: "https://sepolia.basescan.org",
  11155111: "https://sepolia.etherscan.io",
  97: "https://testnet.bscscan.com"
};

const EXPLORER_ENV_KEY_BY_CHAIN_ID: Record<number, string> = {
  1: "VITE_ETH_EXPLORER_BASE_URL",
  11155111: "VITE_ETH_SEPOLIA_EXPLORER_BASE_URL",
  8453: "VITE_BASE_EXPLORER_BASE_URL",
  84532: "VITE_BASE_SEPOLIA_EXPLORER_BASE_URL",
  56: "VITE_BSC_EXPLORER_BASE_URL",
  97: "VITE_BSC_TESTNET_EXPLORER_BASE_URL"
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

export function isSupportedNetworkChainId(chainId: string | number | null | undefined) {
  if (chainId == null || chainId === "") return false;
  const id = Number(chainId);
  if (!Number.isFinite(id)) return false;
  return getSupportedNetworks().some((n) => n.chainId === id);
}

export function getAddEthereumChainParameter(network: SupportedNetwork): AddEthereumChainParameter | null {
  const env = getEnv();
  const configured = getConfiguredFeedNetworks(env).find((n) => n.chainId === network.chainId);
  const rpcUrl = configured?.rpcUrl?.trim() || DEFAULT_RPC_URL_BY_CHAIN_ID[network.chainId];
  if (!rpcUrl) return null;

  const explorerKey = EXPLORER_ENV_KEY_BY_CHAIN_ID[network.chainId];
  const explorerUrl = explorerKey
    ? getEnvString(env, explorerKey)?.trim() || DEFAULT_EXPLORER_URL_BY_CHAIN_ID[network.chainId]
    : DEFAULT_EXPLORER_URL_BY_CHAIN_ID[network.chainId];
  const isBnb = network.chainId === 56 || network.chainId === 97;

  return {
    chainId: formatAddEthereumChainId(network.chainId),
    chainName: network.displayName,
    nativeCurrency: {
      name: isBnb ? "BNB" : "Ether",
      symbol: isBnb ? "BNB" : "ETH",
      decimals: 18
    },
    rpcUrls: [rpcUrl],
    ...(explorerUrl ? { blockExplorerUrls: [explorerUrl.replace(/\/+$/, "")] } : {})
  };
}
