import { withTimeout } from "@shared/lib/feedQuery";
import { getReadContext, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

export async function getFeedReadContext(params: {
  provider: ChainProvider | null;
  chainId: string | null;
  targetChainId?: string | null;
  contract: ContractLike;
}): Promise<
  | { canRead: false }
  | {
      canRead: true;
      chainIdNum: number | null;
      keyChainId: string | null;
      readProvider: ChainProvider;
      readContract: SocialPostsContract;
    }
> {
  const readCtx = await getReadContext({
    provider: params.provider,
    chainId: params.chainId,
    targetChainId: params.targetChainId,
    contract: params.contract,
    resolveOpts: {
      withTimeout,
      codeTimeoutMs: 3_000,
      probeTimeoutMs: 3_000,
      label: `resolve ${params.targetChainId ?? params.chainId ?? ""}`
    }
  });

  if (!readCtx.canRead) return { canRead: false };
  return {
    canRead: true,
    chainIdNum: readCtx.chainIdNum,
    keyChainId: readCtx.keyChainId,
    readProvider: readCtx.readProvider,
    readContract: readCtx.readContract
  };
}
