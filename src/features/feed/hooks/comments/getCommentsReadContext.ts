import type { FeedNetworkConfig } from "../../services/feedNetworks";
import { getConfiguredFeedNetworks } from "../../services/feedNetworks";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getRpcProvider } from "@shared/lib/rpc";
import { resolveSocialPostsAddress } from "../../services/resolveSocialPostsAddress";
import { withTimeout } from "@shared/lib/feedQuery";
import { getSocialContract, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";
import { getEnv } from "@shared/lib/env";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

export async function getCommentsReadContext(params: {
  provider: ChainProvider | null;
  chainId: string | null;
  postChainId?: string | null;
  contract: ContractLike;
}): Promise<
  | {
      canRead: false;
    }
  | {
      canRead: true;
      readProvider: ChainProvider;
      readContract: SocialPostsContract;
      keyChainId: string | null;
    }
> {
  const { provider, chainId, postChainId, contract } = params;

  const env = getEnv();
  const configuredNetworks = getConfiguredFeedNetworks(env);

  const targetChainId = parseChainIdNumber(postChainId ?? chainId);
  const targetCfg: FeedNetworkConfig | undefined =
    targetChainId != null ? configuredNetworks.find((n) => n.chainId === targetChainId) : undefined;
  const targetRpcUrl = typeof targetCfg?.rpcUrl === "string" ? String(targetCfg.rpcUrl).trim() : "";

  const canUseEnvRpc = !!targetCfg && !!targetRpcUrl;
  if (!provider && !canUseEnvRpc) return { canRead: false };

  const keyChainId = postChainId ?? chainId;

  if (canUseEnvRpc) {
    const readProvider = getRpcProvider(targetRpcUrl, targetCfg!.chainId);
    const resolved = await resolveSocialPostsAddress(targetCfg!, readProvider, {
      withTimeout,
      codeTimeoutMs: 3_000,
      probeTimeoutMs: 3_000,
      label: `resolve ${targetCfg!.chainId}`
    });
    const readContract = getSocialContract(resolved, readProvider);
    return { canRead: true, readProvider, readContract, keyChainId };
  }

  await contract.ensureContractDeployedOnCurrentNetwork();
  const readContract = await contract.getReadContract();
  return { canRead: true, readProvider: provider!, readContract, keyChainId };
}
