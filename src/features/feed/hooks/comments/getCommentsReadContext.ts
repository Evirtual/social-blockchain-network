import type { FeedNetworkConfig } from "../../services/feedNetworks";
import { getConfiguredFeedNetworks } from "../../services/feedNetworks";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getRpcProvider } from "@shared/lib/rpc";
import { resolveSocialPostsAddress } from "@shared/lib/resolveSocialPostsAddress";
import { withTimeout } from "@shared/lib/feedQuery";
import { getSocialContract } from "../../../contract";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

export async function getCommentsReadContext(params: {
  provider: any;
  chainId: string | null;
  postChainId?: string | null;
  contract: ContractLike;
}): Promise<
  | {
      canRead: false;
    }
  | {
      canRead: true;
      readProvider: any;
      readContract: any;
      keyChainId: string | null;
    }
> {
  const { provider, chainId, postChainId, contract } = params;

  const env = import.meta.env as any;
  const configuredNetworks = getConfiguredFeedNetworks(env);

  const targetChainId = parseChainIdNumber(postChainId ?? chainId);
  const targetCfg: FeedNetworkConfig | undefined =
    targetChainId != null ? configuredNetworks.find((n) => n.chainId === targetChainId) : undefined;
  const targetRpcUrl = typeof targetCfg?.rpcUrl === "string" ? String(targetCfg.rpcUrl).trim() : "";

  const canUseEnvRpc = !!targetCfg && !!targetRpcUrl;
  if (!provider && !canUseEnvRpc) return { canRead: false };

  const keyChainId = postChainId ?? chainId;

  if (canUseEnvRpc) {
    const readProvider: any = getRpcProvider(targetRpcUrl, targetCfg!.chainId);
    const resolved = await resolveSocialPostsAddress(targetCfg!, readProvider, {
      withTimeout,
      codeTimeoutMs: 3_000,
      probeTimeoutMs: 3_000,
      label: `resolve ${targetCfg!.chainId}`
    });
    const readContract: any = getSocialContract(resolved, readProvider);
    return { canRead: true, readProvider, readContract, keyChainId };
  }

  await contract.ensureContractDeployedOnCurrentNetwork();
  const readContract = await contract.getReadContract();
  return { canRead: true, readProvider: provider, readContract, keyChainId };
}
