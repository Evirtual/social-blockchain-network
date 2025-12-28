import { createContext, useContext, useMemo } from "react";
import { useFollowScans, useIsFollowing } from "../../follow";
import { useContract } from "./ContractContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";

export type FollowContextValue = {
  // Follow graph (cache)
  isFollowingByAddress: Record<string, boolean | undefined>;
  loadIsFollowing: (followee: string) => Promise<void>;
  toggleFollow: (followee: string) => Promise<void>;

  // Followers
  followerCountByAddress: Record<string, number>;
  isLoadingFollowerCountByAddress: Record<string, boolean>;
  loadFollowerCountForAddress: (address: string) => Promise<void>;

  // Followers + Following lists
  followersByAddress: Record<string, string[]>;
  isLoadingFollowersByAddress: Record<string, boolean>;
  loadFollowersForAddress: (address: string) => Promise<void>;

  followingByAddress: Record<string, string[]>;
  isLoadingFollowingByAddress: Record<string, boolean>;
  loadFollowingForAddress: (address: string) => Promise<void>;
};

const FollowContext = createContext<FollowContextValue | null>(null);

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

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error("useFollow must be used within <FollowProvider>");
  return ctx;
}
