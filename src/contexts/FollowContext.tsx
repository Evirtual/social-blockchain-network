import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { socialInterface } from "../contracts/socialPosts";
import { getErrorMessage } from "../lib/errors";
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
  }, [walletAddress]);

  const loadIsFollowing = useCallback(
    async (followee: string) => {
      try {
        if (!provider) return;
        if (!walletAddress) return;
        if (!followee) return;
        const key = followee.toLowerCase();

        await ensureContractDeployedOnCurrentNetwork();
        const readContract = await getReadContract();
        const ok = (await (readContract as any).isFollowing(walletAddress, followee)) as boolean;
        setIsFollowingByAddress((prev) => ({ ...prev, [key]: !!ok }));
      } catch {
        // ignore
      }
    },
    [provider, walletAddress, ensureContractDeployedOnCurrentNetwork, getReadContract]
  );

  const toggleFollow = useCallback(
    async (followee: string) => {
      try {
        if (!walletAddress) {
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

      const existing = followerCountInFlightRef.current[key];
      if (existing) {
        await existing;
        return;
      }

      const task = (async () => {
        setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();

          const latest = await provider.getBlockNumber();
          const maxRounds = 60;
          const maxEvents = 5_000;
          let windowSize = 75_000;
          const minWindowSize = 2_000;

          const collected: ethers.Log[] = [];

          const pullRange = async (fromBlock: number, toBlock: number) => {
            const [followed, unfollowed] = await Promise.all([
              (readContract as any).queryFilter((readContract as any).filters.Followed(null, address), fromBlock, toBlock),
              (readContract as any).queryFilter((readContract as any).filters.Unfollowed(null, address), fromBlock, toBlock)
            ]);
            return [...(followed as any[]), ...(unfollowed as any[])].sort((a, b) => {
              const ab = Number(a.blockNumber ?? 0);
              const bb = Number(b.blockNumber ?? 0);
              if (ab !== bb) return ab - bb;
              const ai = Number(a.index ?? a.logIndex ?? 0);
              const bi = Number(b.index ?? b.logIndex ?? 0);
              return ai - bi;
            });
          };

          let end = latest;
          for (let round = 0; round < maxRounds && end >= 0 && collected.length < maxEvents; round++) {
            const start = Math.max(0, end - windowSize);
            try {
              const logs = await pullRange(start, end);
              collected.unshift(...(logs as any));
              if (start === 0) break;
              end = start - 1;
            } catch {
              if (windowSize <= minWindowSize) throw new Error("RPC could not serve follower log range.");
              windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
            }
          }

          const state = new Map<string, boolean>();
          for (const log of collected) {
            let parsed: ethers.LogDescription | null = null;
            try {
              parsed = socialInterface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
            } catch {
              parsed = null;
            }
            if (!parsed) continue;
            const follower = (parsed.args?.[0] as string | undefined) ?? "";
            if (!follower) continue;

            if (parsed.name === "Followed") {
              state.set(follower.toLowerCase(), true);
            } else if (parsed.name === "Unfollowed") {
              state.set(follower.toLowerCase(), false);
            }
          }

          const count = Array.from(state.values()).filter(Boolean).length;
          setFollowerCountByAddress((prev) => ({ ...prev, [key]: count }));
          loadedFollowerCountByAddressRef.current[key] = true;
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: false }));
        }
      })();

      followerCountInFlightRef.current[key] = task;
      try {
        await task;
      } finally {
        if (followerCountInFlightRef.current[key] === task) {
          followerCountInFlightRef.current[key] = null;
        }
      }
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, setStatus]
  );

  const loadFollowersForAddress = useCallback(
    async (address: string) => {
      if (!provider) return;
      if (!address) return;
      const key = address.toLowerCase();

      if (loadedFollowersByAddressRef.current[key]) return;

      const existing = followersInFlightRef.current[key];
      if (existing) {
        await existing;
        return;
      }

      const task = (async () => {
        setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();

          const latest = await provider.getBlockNumber();
          const maxRounds = 60;
          const maxEvents = 7_500;
          let windowSize = 75_000;
          const minWindowSize = 2_000;

          const collected: ethers.Log[] = [];

          const pullRange = async (fromBlock: number, toBlock: number) => {
            const [followed, unfollowed] = await Promise.all([
              (readContract as any).queryFilter((readContract as any).filters.Followed(null, address), fromBlock, toBlock),
              (readContract as any).queryFilter((readContract as any).filters.Unfollowed(null, address), fromBlock, toBlock)
            ]);
            return [...(followed as any[]), ...(unfollowed as any[])].sort((a, b) => {
              const ab = Number(a.blockNumber ?? 0);
              const bb = Number(b.blockNumber ?? 0);
              if (ab !== bb) return ab - bb;
              const ai = Number(a.index ?? a.logIndex ?? 0);
              const bi = Number(b.index ?? b.logIndex ?? 0);
              return ai - bi;
            });
          };

          let end = latest;
          for (let round = 0; round < maxRounds && end >= 0 && collected.length < maxEvents; round++) {
            const start = Math.max(0, end - windowSize);
            try {
              const logs = await pullRange(start, end);
              collected.unshift(...(logs as any));
              if (start === 0) break;
              end = start - 1;
            } catch {
              if (windowSize <= minWindowSize) throw new Error("RPC could not serve follower log range.");
              windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
            }
          }

          const state = new Map<string, { following: boolean; lastBlock: number }>();
          for (const log of collected) {
            let parsed: ethers.LogDescription | null = null;
            try {
              parsed = socialInterface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
            } catch {
              parsed = null;
            }
            if (!parsed) continue;
            const follower = (parsed.args?.[0] as string | undefined) ?? "";
            if (!follower) continue;
            const blockNumber = Number((log as any).blockNumber ?? 0);

            if (parsed.name === "Followed") {
              state.set(follower.toLowerCase(), { following: true, lastBlock: blockNumber });
            } else if (parsed.name === "Unfollowed") {
              state.set(follower.toLowerCase(), { following: false, lastBlock: blockNumber });
            }
          }

          const active = Array.from(state.entries())
            .filter(([, v]) => v.following)
            .sort((a, b) => (b[1].lastBlock ?? 0) - (a[1].lastBlock ?? 0))
            .map(([addr]) => addr);

          setFollowersByAddress((prev) => ({ ...prev, [key]: active }));
          loadedFollowersByAddressRef.current[key] = true;
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: false }));
        }
      })();

      followersInFlightRef.current[key] = task;
      try {
        await task;
      } finally {
        if (followersInFlightRef.current[key] === task) {
          followersInFlightRef.current[key] = null;
        }
      }
    },
    [provider, ensureContractDeployedOnCurrentNetwork, getReadContract, setStatus]
  );

  const loadFollowingForAddress = useCallback(
    async (address: string) => {
      if (!provider) return;
      if (!address) return;
      const key = address.toLowerCase();

      if (loadedFollowingByAddressRef.current[key]) return;

      const existing = followingInFlightRef.current[key];
      if (existing) {
        await existing;
        return;
      }

      const task = (async () => {
        setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();

          const latest = await provider.getBlockNumber();
          const maxRounds = 60;
          const maxEvents = 7_500;
          let windowSize = 75_000;
          const minWindowSize = 2_000;

          const collected: ethers.Log[] = [];

          const pullRange = async (fromBlock: number, toBlock: number) => {
            const [followed, unfollowed] = await Promise.all([
              (readContract as any).queryFilter((readContract as any).filters.Followed(address, null), fromBlock, toBlock),
              (readContract as any).queryFilter((readContract as any).filters.Unfollowed(address, null), fromBlock, toBlock)
            ]);
            return [...(followed as any[]), ...(unfollowed as any[])].sort((a, b) => {
              const ab = Number(a.blockNumber ?? 0);
              const bb = Number(b.blockNumber ?? 0);
              if (ab !== bb) return ab - bb;
              const ai = Number(a.index ?? a.logIndex ?? 0);
              const bi = Number(b.index ?? b.logIndex ?? 0);
              return ai - bi;
            });
          };

          let end = latest;
          for (let round = 0; round < maxRounds && end >= 0 && collected.length < maxEvents; round++) {
            const start = Math.max(0, end - windowSize);
            try {
              const logs = await pullRange(start, end);
              collected.unshift(...(logs as any));
              if (start === 0) break;
              end = start - 1;
            } catch {
              if (windowSize <= minWindowSize) throw new Error("RPC could not serve following log range.");
              windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
            }
          }

          const state = new Map<string, { following: boolean; lastBlock: number }>();
          for (const log of collected) {
            let parsed: ethers.LogDescription | null = null;
            try {
              parsed = socialInterface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
            } catch {
              parsed = null;
            }
            if (!parsed) continue;
            const followee = (parsed.args?.[1] as string | undefined) ?? "";
            if (!followee) continue;
            const blockNumber = Number((log as any).blockNumber ?? 0);

            if (parsed.name === "Followed") {
              state.set(followee.toLowerCase(), { following: true, lastBlock: blockNumber });
            } else if (parsed.name === "Unfollowed") {
              state.set(followee.toLowerCase(), { following: false, lastBlock: blockNumber });
            }
          }

          const active = Array.from(state.entries())
            .filter(([, v]) => v.following)
            .sort((a, b) => (b[1].lastBlock ?? 0) - (a[1].lastBlock ?? 0))
            .map(([addr]) => addr);

          setFollowingByAddress((prev) => ({ ...prev, [key]: active }));
          loadedFollowingByAddressRef.current[key] = true;
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: false }));
        }
      })();

      followingInFlightRef.current[key] = task;
      try {
        await task;
      } finally {
        if (followingInFlightRef.current[key] === task) {
          followingInFlightRef.current[key] = null;
        }
      }
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
