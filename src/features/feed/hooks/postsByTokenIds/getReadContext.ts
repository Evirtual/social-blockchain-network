import { getSocialContract } from "../../../contract";
import type { FeedNetworkConfig } from "../../services/feedNetworks";
import { getConfiguredFeedNetworks } from "../../services/feedNetworks";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getRpcProvider } from "@shared/lib/rpc";
import { resolveSocialPostsAddress } from "../../services/resolveSocialPostsAddress";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

export async function getPostsByTokenIdsReadContext(params: {
  provider: any;
  chainId: string | null;
  postChainId?: string | null;
  contract: ContractLike;
}): Promise<
  | { canRead: false }
  | {
      canRead: true;
      currentChainId: number | null;
      readProvider: any;
      readContract: any;
    }
> {
  const { provider, chainId, postChainId, contract } = params;

  const currentChainId = parseChainIdNumber(postChainId ?? chainId);

  const env = import.meta.env as any;
  const configuredNetworks = getConfiguredFeedNetworks(env);

  const currentCfg = currentChainId != null ? configuredNetworks.find((n) => n.chainId === currentChainId) : undefined;
  const currentRpcUrl = typeof currentCfg?.rpcUrl === "string" ? String(currentCfg.rpcUrl).trim() : "";

  const canUseEnvRpc = !!currentCfg && !!currentRpcUrl;
  if (!provider && !canUseEnvRpc) return { canRead: false };

  const readProvider: any = canUseEnvRpc ? getRpcProvider(currentRpcUrl, currentCfg!.chainId) : provider;

  const readContract = canUseEnvRpc
    ? getSocialContract(await resolveRpcContractAddress(currentCfg!, readProvider), readProvider)
    : await (async () => {
        await contract.ensureContractDeployedOnCurrentNetwork();
        return await contract.getReadContract();
      })();

  return { canRead: true, currentChainId, readProvider, readContract };
}

async function resolveRpcContractAddress(cfg: FeedNetworkConfig, rpcProvider: any) {
  return await resolveSocialPostsAddress(cfg, rpcProvider);
}
