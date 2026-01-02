import type { FeedNetworkConfig } from "../../services/feedNetworks";
import { resolveSocialPostsAddress } from "../../services/resolveSocialPostsAddress";
import type { ChainProvider } from "@features/contract";

export function createResolveRpcContractAddress(params: {
  withTimeout: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;
}) {
  const { withTimeout } = params;

  return async (cfg: FeedNetworkConfig, rpcProvider: ChainProvider) => {
    return await resolveSocialPostsAddress(cfg, rpcProvider, {
      withTimeout,
      codeTimeoutMs: 3_000,
      probeTimeoutMs: 3_000,
      label: `resolve ${cfg.chainId}`
    });
  };
}
