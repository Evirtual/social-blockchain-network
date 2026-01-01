import type { FeedNetworkConfig } from "../../services/feedNetworks";
import { getConfiguredFeedNetworks } from "../../services/feedNetworks";

const FEED_RPC_FALLBACK_LOOKBACK_BLOCKS = 200_000;

export function getFeedRefreshConfig(params: {
  env: any;
  currentChainIdNumber: number | null;
}): {
  maxLookbackBlocks: number;
  configuredNetworks: FeedNetworkConfig[];
  extraNetworks: FeedNetworkConfig[];
} {
  const { env, currentChainIdNumber } = params;

  const maxLookbackBlocks = FEED_RPC_FALLBACK_LOOKBACK_BLOCKS;

  const configuredNetworks = getConfiguredFeedNetworks(env);

  const extraNetworks = configuredNetworks.filter(
    (n) => currentChainIdNumber == null || n.chainId !== currentChainIdNumber
  );

  return { maxLookbackBlocks, configuredNetworks, extraNetworks };
}
