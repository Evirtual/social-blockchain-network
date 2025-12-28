import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { socialInterface } from "../contracts/socialPosts";
import { getErrorMessage } from "../lib/errors";
import { runInFlight } from "../lib/inFlight";
import { scanActiveFollowAddresses } from "../lib/followEventScanner";
import { requestConnectNudge } from "../lib/connectNudge";
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
  const { provider, walletAddress } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();
  const { runContractTx } = useContractTx();

  const loadedFollowerCountByAddressRef = useRef<Record<string, boolean>>({});
  const loadedFollowersByAddressRef = useRef<Record<string, boolean>>({});
  const loadedFollowingByAddressRef = useRef<Record<string, boolean>>({});

  const ensureContractDeployedOnCurrentNetwork = contract.ensureContractDeployedOnCurrentNetwork;
  const getReadContract = contract.getReadContract;
  const getWriteContract = contract.getWriteContract;

  const [isFollowingByAddress, setIsFollowingByAddress] = useState<Record<string, boolean | undefined>>({});
  const loadedIsFollowingByAddressRef = useRef<Record<string, boolean>>({});
  const isFollowingInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followerCountByAddress, setFollowerCountByAddress] = useState<Record<string, number>>({});
  const [isLoadingFollowerCountByAddress, setIsLoadingFollowerCountByAddress] = useState<Record<string, boolean>>({});
  const followerCountInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followersByAddress, setFollowersByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingFollowersByAddress, setIsLoadingFollowersByAddress] = useState<Record<string, boolean>>({});
  const followersInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followingByAddress, setFollowingByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingFollowingByAddress, setIsLoadingFollowingByAddress] = useState<Record<string, boolean>>({});
  const followingInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  useEffect(() => {
    setIsFollowingByAddress({});
    loadedIsFollowingByAddressRef.current = {};
    isFollowingInFlightRef.current = {};
  }, [walletAddress]);

  const loadIsFollowing = useCallback(
    async (followee: string) => {
      try {
        if (!provider) return;
        if (!walletAddress) return;
        if (!followee) return;
        const key = followee.toLowerCase();

        if (loadedIsFollowingByAddressRef.current[key]) return;
        if (typeof isFollowingByAddress[key] === "boolean") {
          loadedIsFollowingByAddressRef.current[key] = true;
          return;
        }

        await runInFlight(isFollowingInFlightRef.current, key, async () => {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();
          const ok = (await (readContract as any).isFollowing(walletAddress, followee)) as boolean;
          setIsFollowingByAddress((prev) => ({ ...prev, [key]: !!ok }));
          loadedIsFollowingByAddressRef.current[key] = true;
        });
      } catch {
        // ignore
      }
    },
    [provider, walletAddress, isFollowingByAddress, ensureContractDeployedOnCurrentNetwork, getReadContract]
  );

  const toggleFollow = useCallback(
    async (followee: string) => {
      try {
        if (!walletAddress) {
          requestConnectNudge();
          setStatus("Connect your wallet first.");
          return;
        }
        if (!followee) return;
        if (followee.toLowerCase() === walletAddress.toLowerCase()) {
          setStatus("You cannot follow yourself.");
          return;
        }

        const writeContract = await getWriteContract();
        const key = followee.toLowerCase();

        let currently = isFollowingByAddress[key];
        if (typeof currently !== "boolean") {
          currently = (await (writeContract as any).isFollowing(walletAddress, followee)) as boolean;
        }

        const ok = await runContractTx<boolean>(
          currently ? "Unfollow" : "Follow",
          () => ((currently ? (writeContract as any).unfollow(followee) : (writeContract as any).follow(followee)) as any),
          () => true
        );
        if (!ok) return;

        setIsFollowingByAddress((prev) => ({ ...prev, [key]: !currently }));
      } catch (error) {
        setStatus(getErrorMessage(error));
      }
    },
    [walletAddress, isFollowingByAddress, getWriteContract, runContractTx, setStatus]
  );

  const loadFollowerCountForAddress = useCallback(
    async (address: string) => {
      if (!provider) return;
      if (!address) return;
      const key = address.toLowerCase();

      if (loadedFollowerCountByAddressRef.current[key]) return;

      await runInFlight(followerCountInFlightRef.current, key, async () => {
        setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();

          const activeFollowers = await scanActiveFollowAddresses({
            readContract,
            scanProvider: provider,
            iface: socialInterface,
            followedFilter: (readContract as any).filters.Followed(null, address),
            unfollowedFilter: (readContract as any).filters.Unfollowed(null, address),
            addressArgIndex: 0,
            maxEvents: 5_000,
            errorLabel: "follower"
          });

          const count = activeFollowers.length;
          setFollowerCountByAddress((prev) => ({ ...prev, [key]: count }));
          loadedFollowerCountByAddressRef.current[key] = true;
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, setStatus]
  );

  const loadFollowersForAddress = useCallback(
    async (address: string) => {
      if (!provider) return;
      if (!address) return;
      const key = address.toLowerCase();

      if (loadedFollowersByAddressRef.current[key]) return;

      await runInFlight(followersInFlightRef.current, key, async () => {
        setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();

          const active = await scanActiveFollowAddresses({
            readContract,
            scanProvider: provider,
            iface: socialInterface,
            followedFilter: (readContract as any).filters.Followed(null, address),
            unfollowedFilter: (readContract as any).filters.Unfollowed(null, address),
            addressArgIndex: 0,
            maxEvents: 7_500,
            errorLabel: "follower"
          });

          setFollowersByAddress((prev) => ({ ...prev, [key]: active }));
          loadedFollowersByAddressRef.current[key] = true;
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, setStatus]
  );

  const loadFollowingForAddress = useCallback(
    async (address: string) => {
      if (!provider) return;
      if (!address) return;
      const key = address.toLowerCase();

      if (loadedFollowingByAddressRef.current[key]) return;

      await runInFlight(followingInFlightRef.current, key, async () => {
        setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();

          const active = await scanActiveFollowAddresses({
            readContract,
            scanProvider: provider,
            iface: socialInterface,
            followedFilter: (readContract as any).filters.Followed(address, null),
            unfollowedFilter: (readContract as any).filters.Unfollowed(address, null),
            addressArgIndex: 1,
            maxEvents: 7_500,
            errorLabel: "following"
          });

          setFollowingByAddress((prev) => ({ ...prev, [key]: active }));
          loadedFollowingByAddressRef.current[key] = true;
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, setStatus]
  );

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
