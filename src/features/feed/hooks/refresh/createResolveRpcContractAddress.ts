import type { ContractNetworkConfig } from "@features/contract/services/contractNetworks";
import { resolveSocialPostsAddress } from "@features/contract/services/resolveSocialPostsAddress";
import type { ChainProvider } from "@features/contract";

export function createResolveRpcContractAddress(params: {
  withTimeout: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;
}) {
  const { withTimeout } = params;

  return async (cfg: ContractNetworkConfig, rpcProvider: ChainProvider) => {
    return await resolveSocialPostsAddress(cfg, rpcProvider, {
      withTimeout,
      codeTimeoutMs: 3_000,
      probeTimeoutMs: 3_000,
      label: `resolve ${cfg.chainId}`
    });
  };
}
