import { useCallback, useEffect, useMemo } from "react";
import { useFollowScans, useIsFollowing } from "../hooks";
import { useContractActions } from "@features/contract";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";
import { useContractTx } from "@features/app/providers/useContractTx";
import { FollowContext, type FollowContextValue } from "./followStateContext";

export type { FollowContextValue } from "./followStateContext";

export function FollowProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId } = useWalletState();
  const { setStatus } = useStatusActions();
  const contract = useContractActions();
  const { runContractTx } = useContractTx();

  const ensureContractDeployedOnCurrentNetwork = contract.ensureContractDeployedOnCurrentNetwork;
  const getReadContract = contract.getReadContract;
  const getWriteContract = contract.getWriteContract;

  const { isFollowingByAddress, loadIsFollowing, toggleFollow: toggleFollowBase } = useIsFollowing({
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
    loadFollowingForAddress,
    applyFollowUpdate
  } = useFollowScans({
    provider,
    chainId,
    ensureContractDeployedOnCurrentNetwork,
    getReadContract,
    setStatus
  });

  const toggleFollow = useCallback(
    async (followee: string) => {
      const next = await toggleFollowBase(followee);
      if (typeof next !== "boolean") return undefined;
      if (!walletAddress) return next;
      applyFollowUpdate({ follower: walletAddress, followee, isFollowing: next });
      return next;
    },
    [toggleFollowBase, walletAddress, applyFollowUpdate]
  );

  // Prefetch self follow data so sidebar stats/modals don't wait on route-level effects.
  useEffect(() => {
    if (!walletAddress) return;
    if (!chainId) return;
    void loadFollowerCountForAddress(walletAddress);
    void loadFollowersForAddress(walletAddress);
    void loadFollowingForAddress(walletAddress);
  }, [walletAddress, chainId, loadFollowerCountForAddress, loadFollowersForAddress, loadFollowingForAddress]);

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
