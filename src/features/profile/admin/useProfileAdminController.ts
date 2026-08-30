import type { Post } from "@types";
import { usePosterAdminStatus } from "./usePosterAdminStatus";
import { useProfileAdminActions } from "./useProfileAdminActions";
import type { TransactionResponse } from "ethers";
import type { ReadContractFactory, WriteContractFactory } from "@features/contract/types";

export function useProfileAdminController(params: {
  address: string;
  contract: {
    isOwner: boolean;
    ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
    getReadContract: ReadContractFactory;
    getWriteContract: WriteContractFactory;
  };
  runContractTx: <T = void>(
    label: string,
    send: () => Promise<TransactionResponse>,
    onSuccess?: () => T
  ) => Promise<T | undefined>;
  feedPosts: Post[];
  refreshFeed: () => Promise<void>;
  walletChainId: string | null;
  loadProfile: () => Promise<void>;
}) {
  const { address, contract, runContractTx, feedPosts, refreshFeed, walletChainId, loadProfile } = params;

  const posterAdminStatus = usePosterAdminStatus({
    contract: {
      isOwner: contract.isOwner,
      ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
      getReadContract: contract.getReadContract
    },
    address
  });

  const { onAdminSetPosterAllowed, onAdminReset, onAdminSetProfile } = useProfileAdminActions({
    address,
    contract: {
      isOwner: contract.isOwner,
      getReadContract: contract.getReadContract,
      getWriteContract: contract.getWriteContract
    },
    runContractTx,
    feedPosts,
    refreshFeed,
    walletChainId,
    loadProfile,
    setIsPosterAllowed: posterAdminStatus.setIsPosterAllowed,
    setWasPosterDisapprovedEver: posterAdminStatus.setWasPosterDisapprovedEver
  });

  return {
    isPosterAllowed: posterAdminStatus.isPosterAllowed,
    wasPosterDisapprovedEver: posterAdminStatus.wasPosterDisapprovedEver,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile
  };
}
