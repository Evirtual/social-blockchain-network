import { useCallback, useEffect, useRef, useState } from "react";
import { socialInterface } from "../../contract";
import { getErrorMessage } from "@shared/lib/errors";
import { runInFlight } from "@shared/lib/inFlight";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";
import { scanActiveFollowAddresses } from "../services/followEventScanner";
import { parseChainKey } from "@shared/lib/chainKey";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { addressKey } from "./utils";

// In-memory caches to persist results across route navigation without using sessionStorage.
// Keys include chainId so data never bleeds across networks.
const followersByKeyCache = new Map<string, string[]>();
const followingByKeyCache = new Map<string, string[]>();
const followerCountByKeyCache = new Map<string, number>();

function makeCacheKey(chainId: string | null, addressLower: string) {
  const addr = String(addressLower ?? "").trim().toLowerCase();
  if (!addr) return null;
  const chainKey = parseChainKey(chainId);
  return `${chainKey}:${addr}`;
}

export function useFollowScans(params: {
  provider: any | null;
  chainId: string | null;
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

  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const isInitial = lastChainIdRef.current === undefined;
    if (params.chainId === lastChainIdRef.current) return;
    lastChainIdRef.current = params.chainId;
    if (isInitial) return;

    loadedFollowerCountByAddressRef.current = {};
    loadedFollowersByAddressRef.current = {};
    loadedFollowingByAddressRef.current = {};

    followerCountInFlightRef.current = {};
    followersInFlightRef.current = {};
    followingInFlightRef.current = {};

    setFollowerCountByAddress({});
    setIsLoadingFollowerCountByAddress({});
    setFollowersByAddress({});
    setIsLoadingFollowersByAddress({});
    setFollowingByAddress({});
    setIsLoadingFollowingByAddress({});
  }, [params.chainId]);

  const loadFollowerCountForAddress = useCallback(
    async (address: string) => {
      if (!address) return;
      const key = addressKey(address);

      const cacheKey = makeCacheKey(params.chainId, key);
      if (cacheKey && followerCountByKeyCache.has(cacheKey)) {
        setFollowerCountByAddress((prev) => ({ ...prev, [key]: followerCountByKeyCache.get(cacheKey)! }));
        loadedFollowerCountByAddressRef.current[key] = true;
        return;
      }

      if (loadedFollowerCountByAddressRef.current[key]) return;

      const env = import.meta.env as any;
      const chainIdNum = parseChainIdNumber(params.chainId);
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (subgraphUrl) {
        try {
          const query = `
            query FollowerCount($id: ID!) {
              account(id: $id) {
                followersCount
              }
            }
          `;

          const data = await querySubgraph<{ account: { followersCount?: string } | null }>({
            url: subgraphUrl,
            query,
            variables: { id: key },
            timeoutMs: 10_000
          });

          const count = Number(data?.account?.followersCount ?? 0);
          setFollowerCountByAddress((prev) => ({ ...prev, [key]: Number.isFinite(count) ? count : 0 }));
          if (cacheKey) followerCountByKeyCache.set(cacheKey, Number.isFinite(count) ? count : 0);
          loadedFollowerCountByAddressRef.current[key] = true;
          return;
        } catch {
          // fall back to on-chain scan
        }
      }

      if (!params.provider) return;

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
          if (cacheKey) followerCountByKeyCache.set(cacheKey, count);
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
      if (!address) return;
      const key = addressKey(address);

      const cacheKey = makeCacheKey(params.chainId, key);

      if (loadedFollowersByAddressRef.current[key]) return;

      const env = import.meta.env as any;
      const chainIdNum = parseChainIdNumber(params.chainId);
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (subgraphUrl) {
        try {
          const query = `
            query Followers($followee: ID!, $first: Int!) {
              followEdges(
                first: $first,
                where: { followee: $followee, active: true },
                orderBy: updatedAtBlock,
                orderDirection: desc
              ) {
                follower {
                  id
                }
              }
            }
          `;

          const data = await querySubgraph<{ followEdges: Array<{ follower?: { id?: string } | null }> }>({
            url: subgraphUrl,
            query,
            variables: { followee: key, first: 5000 },
            timeoutMs: 12_000
          });

          const normalizedActive = (Array.isArray(data?.followEdges) ? data.followEdges : [])
            .map((e) => String(e?.follower?.id ?? "").trim().toLowerCase())
            .filter(Boolean);

          setFollowersByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
          setFollowerCountByAddress((prev) => ({ ...prev, [key]: normalizedActive.length }));
          if (cacheKey) {
            followersByKeyCache.set(cacheKey, normalizedActive);
            followerCountByKeyCache.set(cacheKey, normalizedActive.length);
          }
          loadedFollowersByAddressRef.current[key] = true;
          loadedFollowerCountByAddressRef.current[key] = true;
          return;
        } catch {
          // fall back to on-chain scan
        }
      }

      if (!params.provider) return;
      if (cacheKey && followersByKeyCache.has(cacheKey)) {
        const cached = followersByKeyCache.get(cacheKey)!;
        setFollowersByAddress((prev) => ({ ...prev, [key]: cached }));
        setFollowerCountByAddress((prev) => ({ ...prev, [key]: cached.length }));
        loadedFollowersByAddressRef.current[key] = true;
        loadedFollowerCountByAddressRef.current[key] = true;
        return;
      }

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

          const normalizedActive = (active ?? []).map((a) => String(a ?? "").trim().toLowerCase()).filter(Boolean);
          setFollowersByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
          setFollowerCountByAddress((prev) => ({ ...prev, [key]: normalizedActive.length }));
          if (cacheKey) {
            followersByKeyCache.set(cacheKey, normalizedActive);
            followerCountByKeyCache.set(cacheKey, normalizedActive.length);
          }
          loadedFollowersByAddressRef.current[key] = true;
          loadedFollowerCountByAddressRef.current[key] = true;
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
      if (!address) return;
      const key = addressKey(address);

      const cacheKey = makeCacheKey(params.chainId, key);

      if (loadedFollowingByAddressRef.current[key]) return;

      const env = import.meta.env as any;
      const chainIdNum = parseChainIdNumber(params.chainId);
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (subgraphUrl) {
        try {
          const query = `
            query Following($follower: ID!, $first: Int!) {
              followEdges(
                first: $first,
                where: { follower: $follower, active: true },
                orderBy: updatedAtBlock,
                orderDirection: desc
              ) {
                followee {
                  id
                }
              }
            }
          `;

          const data = await querySubgraph<{ followEdges: Array<{ followee?: { id?: string } | null }> }>({
            url: subgraphUrl,
            query,
            variables: { follower: key, first: 5000 },
            timeoutMs: 12_000
          });

          const normalizedActive = (Array.isArray(data?.followEdges) ? data.followEdges : [])
            .map((e) => String(e?.followee?.id ?? "").trim().toLowerCase())
            .filter(Boolean);

          setFollowingByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
          if (cacheKey) followingByKeyCache.set(cacheKey, normalizedActive);
          loadedFollowingByAddressRef.current[key] = true;
          return;
        } catch {
          // fall back to on-chain scan
        }
      }

      if (!params.provider) return;
      if (cacheKey && followingByKeyCache.has(cacheKey)) {
        setFollowingByAddress((prev) => ({ ...prev, [key]: followingByKeyCache.get(cacheKey)! }));
        loadedFollowingByAddressRef.current[key] = true;
        return;
      }

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

          const normalizedActive = (active ?? []).map((a) => String(a ?? "").trim().toLowerCase()).filter(Boolean);
          setFollowingByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
          if (cacheKey) followingByKeyCache.set(cacheKey, normalizedActive);
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
