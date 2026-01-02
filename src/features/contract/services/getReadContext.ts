import { getSocialContract, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";
import { getConfiguredFeedNetworks } from "@features/feed/services/feedNetworks";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getEnv } from "@shared/lib/env";
import { getRpcProvider } from "@shared/lib/rpc";
import { resolveSocialPostsAddress } from "@features/feed/services/resolveSocialPostsAddress";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

export type ReadContextResult =
  | { canRead: false }
  | {
      canRead: true;
      chainIdNum: number | null;
      keyChainId: string | null;
      readProvider: ChainProvider;
      readContract: SocialPostsContract;
    };

export async function getReadContext(args: {
  provider: ChainProvider | null;
  chainId: string | null;
  targetChainId?: string | null;
  contract: ContractLike;
  resolveOpts?: {
    withTimeout?: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;
    codeTimeoutMs?: number;
    probeTimeoutMs?: number;
    label?: string;
  };
}): Promise<ReadContextResult> {
  const { provider, chainId, targetChainId, contract, resolveOpts } = args;
  const keyChainId = targetChainId ?? chainId ?? null;
  const chainIdNum = parseChainIdNumber(keyChainId);

  const env = getEnv();
  const configuredNetworks = getConfiguredFeedNetworks(env);
  const targetCfg = chainIdNum != null ? configuredNetworks.find((n) => n.chainId === chainIdNum) : undefined;
  const targetRpcUrl = typeof targetCfg?.rpcUrl === "string" ? String(targetCfg.rpcUrl).trim() : "";

  const canUseEnvRpc = !!targetCfg && !!targetRpcUrl;
  if (!provider && !canUseEnvRpc) return { canRead: false };

  const readProvider = canUseEnvRpc ? getRpcProvider(targetRpcUrl, targetCfg!.chainId) : provider;
  if (!readProvider) return { canRead: false };

  const readContract = canUseEnvRpc
    ? getSocialContract(await resolveSocialPostsAddress(targetCfg!, readProvider, resolveOpts), readProvider)
    : await (async () => {
        await contract.ensureContractDeployedOnCurrentNetwork();
        return await contract.getReadContract();
      })();

  return { canRead: true, chainIdNum, keyChainId, readProvider, readContract };
}
