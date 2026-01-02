import type { ChainProvider, ReadContractFactory, SocialPostsContract } from "@features/contract";
import { getFeedReadContext } from "../getFeedReadContext";

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

  const readCtx = await getFeedReadContext({
    provider,
    chainId,
    targetChainId: postChainId,
    contract
  });

  if (!readCtx.canRead) return { canRead: false };
  return {
    canRead: true,
    readProvider: readCtx.readProvider,
    readContract: readCtx.readContract,
    keyChainId: readCtx.keyChainId
  };
}
