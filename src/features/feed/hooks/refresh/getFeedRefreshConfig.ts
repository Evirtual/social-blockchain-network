import type { ContractNetworkConfig } from "@features/contract/services/contractNetworks";
import type { EnvMap } from "@shared/lib/env";
import { getConfiguredContractNetworks } from "@features/contract/services/contractNetworks";

const FEED_RPC_FALLBACK_LOOKBACK_BLOCKS = 200_000;

export function getFeedRefreshConfig(params: {
  env: EnvMap;
  currentChainIdNumber: number | null;
}): {
  maxLookbackBlocks: number;
  configuredNetworks: ContractNetworkConfig[];
  extraNetworks: ContractNetworkConfig[];
} {
  const { env, currentChainIdNumber } = params;

  const maxLookbackBlocks = FEED_RPC_FALLBACK_LOOKBACK_BLOCKS;

  const configuredNetworks = getConfiguredContractNetworks(env);

  const extraNetworks = configuredNetworks.filter(
    (n) => currentChainIdNumber == null || n.chainId !== currentChainIdNumber
  );

  return { maxLookbackBlocks, configuredNetworks, extraNetworks };
}
