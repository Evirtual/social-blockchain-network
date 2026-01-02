import { getReadContext, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

export async function getPostsByTokenIdsReadContext(params: {
  provider: ChainProvider | null;
  chainId: string | null;
  postChainId?: string | null;
  contract: ContractLike;
}): Promise<
  | { canRead: false }
  | {
      canRead: true;
      currentChainId: number | null;
      readProvider: ChainProvider;
      readContract: SocialPostsContract;
    }
> {
  const { provider, chainId, postChainId, contract } = params;
  const readCtx = await getReadContext({ provider, chainId, targetChainId: postChainId, contract });
  if (!readCtx.canRead) return { canRead: false };
  return {
    canRead: true,
    currentChainId: readCtx.chainIdNum,
    readProvider: readCtx.readProvider,
    readContract: readCtx.readContract
  };
}
