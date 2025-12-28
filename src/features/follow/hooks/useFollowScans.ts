import { useCallback, useRef, useState } from "react";
import { socialInterface } from "../../contract";
import { getErrorMessage } from "@shared/lib/errors";
import { runInFlight } from "@shared/lib/inFlight";
import { scanActiveFollowAddresses } from "../services/followEventScanner";
import { addressKey } from "./utils";

export function useFollowScans(params: {
  provider: any | null;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
  setStatus: (v: string) => void;
}) {
  const loadedFollowerCountByAddressRef = useRef<Record<string, boolean>>({});
  const loadedFollowersByAddressRef = useRef<Record<string, boolean>>({});
  const loadedFollowingByAddressRef = useRef<Record<string, boolean>>({});

  const [followerCountByAddress, setFollowerCountByAddress] = useState<Record<string, number>>({});
  const [isLoadingFollowerCountByAddress, setIsLoadingFollowerCountByAddress] = useState<Record<string, boolean>>({});
  const followerCountInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followersByAddress, setFollowersByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingFollowersByAddress, setIsLoadingFollowersByAddress] = useState<Record<string, boolean>>({});
  const followersInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followingByAddress, setFollowingByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingFollowingByAddress, setIsLoadingFollowingByAddress] = useState<Record<string, boolean>>({});
  const followingInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const loadFollowerCountForAddress = useCallback(
    async (address: string) => {
      if (!params.provider) return;
      if (!address) return;
      const key = addressKey(address);

      if (loadedFollowerCountByAddressRef.current[key]) return;

      await runInFlight(followerCountInFlightRef.current, key, async () => {
        setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();

          const activeFollowers = await scanActiveFollowAddresses({
            readContract,
            scanProvider: params.provider,
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
          params.setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [params.provider, params.ensureContractDeployedOnCurrentNetwork, params.getReadContract, params.setStatus]
  );

  const loadFollowersForAddress = useCallback(
    async (address: string) => {
      if (!params.provider) return;
      if (!address) return;
      const key = addressKey(address);

      if (loadedFollowersByAddressRef.current[key]) return;

      await runInFlight(followersInFlightRef.current, key, async () => {
        setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();

          const active = await scanActiveFollowAddresses({
            readContract,
            scanProvider: params.provider,
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
          params.setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [params.provider, params.ensureContractDeployedOnCurrentNetwork, params.getReadContract, params.setStatus]
  );

  const loadFollowingForAddress = useCallback(
    async (address: string) => {
      if (!params.provider) return;
      if (!address) return;
      const key = addressKey(address);

      if (loadedFollowingByAddressRef.current[key]) return;

      await runInFlight(followingInFlightRef.current, key, async () => {
        setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();

          const active = await scanActiveFollowAddresses({
            readContract,
            scanProvider: params.provider,
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
          params.setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [params.provider, params.ensureContractDeployedOnCurrentNetwork, params.getReadContract, params.setStatus]
  );

  return {
    followerCountByAddress,
    isLoadingFollowerCountByAddress,
    loadFollowerCountForAddress,

    followersByAddress,
    isLoadingFollowersByAddress,
    loadFollowersForAddress,

    followingByAddress,
    isLoadingFollowingByAddress,
    loadFollowingForAddress
  };
}
