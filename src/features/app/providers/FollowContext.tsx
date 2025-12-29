import { useMemo } from "react";
import { useFollowScans, useIsFollowing } from "../../follow";
import { useContract } from "./ContractContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";
import { FollowContext, type FollowContextValue } from "./followStateContext";

export type { FollowContextValue } from "./followStateContext";

export function FollowProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();
  const { runContractTx } = useContractTx();

  const ensureContractDeployedOnCurrentNetwork = contract.ensureContractDeployedOnCurrentNetwork;
  const getReadContract = contract.getReadContract;
  const getWriteContract = contract.getWriteContract;

  const { isFollowingByAddress, loadIsFollowing, toggleFollow } = useIsFollowing({
    provider,
    chainId,
    walletAddress,
    ensureContractDeployedOnCurrentNetwork,
    getReadContract,
    getWriteContract,
    runContractTx,
    setStatus
  });

  const {
    followerCountByAddress,
    isLoadingFollowerCountByAddress,
    loadFollowerCountForAddress,
    followersByAddress,
    isLoadingFollowersByAddress,
    loadFollowersForAddress,
    followingByAddress,
    isLoadingFollowingByAddress,
    loadFollowingForAddress
  } = useFollowScans({
    provider,
    chainId,
    ensureContractDeployedOnCurrentNetwork,
    getReadContract,
    setStatus
  });

  const value = useMemo<FollowContextValue>(
    () => ({
      isFollowingByAddress,
      loadIsFollowing,
      toggleFollow,

      followerCountByAddress,
      isLoadingFollowerCountByAddress,
      loadFollowerCountForAddress,

      followersByAddress,
      isLoadingFollowersByAddress,
      loadFollowersForAddress,

      followingByAddress,
      isLoadingFollowingByAddress,
      loadFollowingForAddress
    }),
    [
      isFollowingByAddress,
      loadIsFollowing,
      toggleFollow,
      followerCountByAddress,
      isLoadingFollowerCountByAddress,
      loadFollowerCountForAddress,
      followersByAddress,
      isLoadingFollowersByAddress,
      loadFollowersForAddress,
      followingByAddress,
      isLoadingFollowingByAddress,
      loadFollowingForAddress
    ]
  );

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}


