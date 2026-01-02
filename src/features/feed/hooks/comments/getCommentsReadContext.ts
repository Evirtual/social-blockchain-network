import { withTimeout } from "@shared/lib/feedQuery";
import { getReadContext, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";

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

  const readCtx = await getReadContext({
    provider,
    chainId,
    targetChainId: postChainId,
    contract,
    resolveOpts: {
      withTimeout,
      codeTimeoutMs: 3_000,
      probeTimeoutMs: 3_000,
      label: `resolve ${postChainId ?? chainId ?? ""}`
    }
  });

  if (!readCtx.canRead) return { canRead: false };
  return {
    canRead: true,
    readProvider: readCtx.readProvider,
    readContract: readCtx.readContract,
    keyChainId: readCtx.keyChainId
  };
}
