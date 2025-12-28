import type { FeedNetworkConfig } from "../../services/feedNetworks";
import { getConfiguredFeedNetworks } from "../../services/feedNetworks";

export function getFeedRefreshConfig(params: {
  env: any;
  currentChainIdNumber: number | null;
}): {
  maxLookbackBlocks: number;
  configuredNetworks: FeedNetworkConfig[];
  extraNetworks: FeedNetworkConfig[];
} {
  const { env, currentChainIdNumber } = params;

  const maxLookbackBlocksRaw = Number(env.VITE_FEED_MAX_LOOKBACK_BLOCKS ?? 200_000);
  const maxLookbackBlocks =
    Number.isFinite(maxLookbackBlocksRaw) && maxLookbackBlocksRaw > 0 ? maxLookbackBlocksRaw : 200_000;

  const configuredNetworks = getConfiguredFeedNetworks(env);

  const extraNetworks = configuredNetworks.filter(
    (n) =>
      typeof n.rpcUrl === "string" &&
      n.rpcUrl.trim().length > 0 &&
      (currentChainIdNumber == null || n.chainId !== currentChainIdNumber)
  );

  return { maxLookbackBlocks, configuredNetworks, extraNetworks };
}
