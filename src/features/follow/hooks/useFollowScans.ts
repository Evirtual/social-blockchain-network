import { useCallback, useEffect, useRef, useState } from "react";
import { socialInterface } from "@features/contract/contracts/socialPosts";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { runInFlight } from "@shared/lib/inFlight";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import { withTimeout } from "@shared/lib/feedQuery";
import { scanActiveFollowAddresses } from "../services/followEventScanner";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { addressKey } from "./utils";
import { useEpochGuard, useEpochLoadingMap } from "@shared/lib/epochGuard";
import { getEnv } from "@shared/lib/env";
import type { ChainProvider, ReadContractFactory } from "@features/contract/types";

export function useFollowScans(params: {
  provider: ChainProvider | null;
  chainId: string | null;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
  setStatus: (v: string) => void;
}) {
  const epochGuard = useEpochGuard();
  const { bumpEpoch, snapshotEpoch, isStale } = epochGuard;
  const loadedFollowerCountByAddressRef = useRef<Record<string, boolean>>({});
  const loadedFollowersByAddressRef = useRef<Record<string, boolean>>({});
  const loadedFollowingByAddressRef = useRef<Record<string, boolean>>({});

  const loadedFollowBundleByAddressRef = useRef<Record<string, boolean>>({});
  const followBundleInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followerCountByAddress, setFollowerCountByAddress] = useState<Record<string, number>>({});
  const [isLoadingFollowerCountByAddress, setIsLoadingFollowerCountByAddress] = useEpochLoadingMap(epochGuard);
  const followerCountInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followersByAddress, setFollowersByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingFollowersByAddress, setIsLoadingFollowersByAddress] = useEpochLoadingMap(epochGuard);
  const followersInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [followingByAddress, setFollowingByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingFollowingByAddress, setIsLoadingFollowingByAddress] = useEpochLoadingMap(epochGuard);
  const followingInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const loadFollowBundleForAddress = useCallback(
    async (address: string, epoch: number) => {
      if (!address) return;
      const key = addressKey(address);
      if (!key) return;

      if (loadedFollowBundleByAddressRef.current[key]) return;
      if (!params.chainId) return;

      const env = getEnv();
      const chainIdNum = parseChainIdNumber(params.chainId);
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (!subgraphUrl) return;

      await runInFlight(followBundleInFlightRef.current, key, async () => {
        // Marking "loading" has to be as guarded as clearing it. This runs at
        // least a microtask after the epoch was snapshotted - and in the callers
        // below, a whole subgraph round trip later - so a chain change can land
        // in between. That resets the loading maps, and an unguarded write here
        // put the key back as true afterwards, while the finally below saw a
        // stale epoch and declined to clear it. The skeleton then stayed up for
        // good: no error, nothing retrying, and only on slow connections where
        // the window was wide enough to hit.
        if (isStale(epoch)) return;
        setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: true }));
        setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: true }));
        setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: true }));

        try {
          const query = `
            query FollowBundle($id: ID!, $first: Int!) {
              account(id: $id) {
                followersCount
              }
              followersEdges: followEdges(
                first: $first,
                where: { followee: $id, active: true },
                orderBy: updatedAtBlock,
                orderDirection: desc
              ) {
                follower {
                  id
                }
              }
              followingEdges: followEdges(
                first: $first,
                where: { follower: $id, active: true },
                orderBy: updatedAtBlock,
                orderDirection: desc
              ) {
                followee {
                  id
                }
              }
            }
          `;

          const result = await tryQuerySubgraph<{
            account: { followersCount?: string } | null;
            followersEdges: Array<{ follower?: { id?: string } | null }>;
            followingEdges: Array<{ followee?: { id?: string } | null }>;
          }>({
            url: subgraphUrl,
            query,
            variables: { id: key, first: 1000 },
            timeoutMs: 12_000
          });

          if (!result.ok) return;
          if (isStale(epoch)) return;

          const followers = (Array.isArray(result.data?.followersEdges) ? result.data.followersEdges : [])
            .map((e) => String(e?.follower?.id ?? "").trim().toLowerCase())
            .filter(Boolean);
          const following = (Array.isArray(result.data?.followingEdges) ? result.data.followingEdges : [])
            .map((e) => String(e?.followee?.id ?? "").trim().toLowerCase())
            .filter(Boolean);

          const countRaw = Number(result.data?.account?.followersCount ?? NaN);
          const count = Number.isFinite(countRaw) ? countRaw : followers.length;

          setFollowerCountByAddress((prev) => ({ ...prev, [key]: count }));
          setFollowersByAddress((prev) => ({ ...prev, [key]: followers }));
          setFollowingByAddress((prev) => ({ ...prev, [key]: following }));

          loadedFollowerCountByAddressRef.current[key] = true;
          loadedFollowersByAddressRef.current[key] = true;
          loadedFollowingByAddressRef.current[key] = true;
          loadedFollowBundleByAddressRef.current[key] = true;
        } finally {
          if (!isStale(epoch)) {
            setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: false }));
            setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: false }));
            setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: false }));
          }
        }
      });
    },
    [params.chainId]
  );

  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const isInitial = lastChainIdRef.current === undefined;
    if (params.chainId === lastChainIdRef.current) return;
    lastChainIdRef.current = params.chainId;
    if (isInitial) return;

    bumpEpoch();
    loadedFollowerCountByAddressRef.current = {};
    loadedFollowersByAddressRef.current = {};
    loadedFollowingByAddressRef.current = {};

    followerCountInFlightRef.current = {};
    followersInFlightRef.current = {};
    followingInFlightRef.current = {};

    setFollowerCountByAddress({});
    setFollowersByAddress({});
    setFollowingByAddress({});
  }, [params.chainId]);

  const loadFollowerCountForAddress = useCallback(
    async (address: string) => {
      if (!address) return;
      const key = addressKey(address);
      const epoch = snapshotEpoch();

      if (loadedFollowerCountByAddressRef.current[key]) return;

      // Avoid slow RPC scans before chainId is known.
      if (!params.chainId) return;

      const env = getEnv();
      const chainIdNum = parseChainIdNumber(params.chainId);
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (subgraphUrl) {
        await loadFollowBundleForAddress(address, epoch);
        if (loadedFollowerCountByAddressRef.current[key]) return;

        await runInFlight(followerCountInFlightRef.current, key, async () => {
          if (isStale(epoch)) return;
          setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const query = `
              query FollowerCount($id: ID!) {
                account(id: $id) {
                  followersCount
                }
              }
            `;

            const result = await tryQuerySubgraph<{ account: { followersCount?: string } | null }>({
              url: subgraphUrl,
              query,
              variables: { id: key },
              timeoutMs: 10_000
            });

            if (result.ok) {
              if (isStale(epoch)) return;
              const count = Number(result.data?.account?.followersCount ?? 0);
              const safeCount = Number.isFinite(count) ? count : 0;
              setFollowerCountByAddress((prev) => ({ ...prev, [key]: safeCount }));
              loadedFollowerCountByAddressRef.current[key] = true;
            } else {
              // eslint-disable-next-line no-console
              console.warn("FollowerCount subgraph query failed; falling back to RPC scan", {
                chainId: params.chainId,
                address: key,
                subgraphUrl,
                err: result.error
              });
            }
          } catch {
            // fall back to on-chain scan
          } finally {
            if (!isStale(epoch)) {
              setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: false }));
            }
          }
        });

        if (loadedFollowerCountByAddressRef.current[key]) return;
      }

      if (!params.provider) return;

      await runInFlight(followerCountInFlightRef.current, key, async () => {
        if (isStale(epoch)) return;
        setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();
          const provider = params.provider;
          if (!provider) return;

          const activeFollowers = await withTimeout(
            scanActiveFollowAddresses({
            readContract,
            scanProvider: provider,
            iface: socialInterface,
            followedFilter: readContract.filters.Followed(null, address),
            unfollowedFilter: readContract.filters.Unfollowed(null, address),
            addressArgIndex: 0,
            maxEvents: 5_000,
            errorLabel: "follower"
            }),
            8_000,
            "follower scan"
          );

          const count = activeFollowers.length;
          if (isStale(epoch)) return;
          setFollowerCountByAddress((prev) => ({ ...prev, [key]: count }));
          loadedFollowerCountByAddressRef.current[key] = true;
        } catch (err) {
          if (!isStale(epoch)) {
            setStatusFromError(params.setStatus, err as ErrorInput);
          }
        } finally {
          if (!isStale(epoch)) {
            setIsLoadingFollowerCountByAddress((prev) => ({ ...prev, [key]: false }));
          }
        }
      });
    },
    [
      params.provider,
      params.chainId,
      params.ensureContractDeployedOnCurrentNetwork,
      params.getReadContract,
      params.setStatus,
      loadFollowBundleForAddress
    ]
  );

  const loadFollowersForAddress = useCallback(
    async (address: string) => {
      if (!address) return;
      const key = addressKey(address);
      const epoch = snapshotEpoch();

      if (loadedFollowersByAddressRef.current[key]) return;

      // Avoid slow RPC scans before chainId is known.
      if (!params.chainId) return;

      const env = getEnv();
      const chainIdNum = parseChainIdNumber(params.chainId);
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (subgraphUrl) {
        await loadFollowBundleForAddress(address, epoch);
        if (loadedFollowersByAddressRef.current[key]) return;

        await runInFlight(followersInFlightRef.current, key, async () => {
          if (isStale(epoch)) return;
          setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: true }));
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

            const result = await tryQuerySubgraph<{ followEdges: Array<{ follower?: { id?: string } | null }> }>({
              url: subgraphUrl,
              query,
              variables: { followee: key, first: 1000 },
              timeoutMs: 12_000
            });

            if (result.ok) {
              if (isStale(epoch)) return;
              const normalizedActive = (Array.isArray(result.data?.followEdges) ? result.data.followEdges : [])
                .map((e) => String(e?.follower?.id ?? "").trim().toLowerCase())
                .filter(Boolean);

              setFollowersByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
              setFollowerCountByAddress((prev) => ({ ...prev, [key]: normalizedActive.length }));
              loadedFollowersByAddressRef.current[key] = true;
              loadedFollowerCountByAddressRef.current[key] = true;
            } else {
              // eslint-disable-next-line no-console
              console.warn("Followers subgraph query failed; falling back to RPC scan", {
                chainId: params.chainId,
                address: key,
                subgraphUrl,
                err: result.error
              });
            }
          } catch {
            // fall back to on-chain scan
          } finally {
            if (!isStale(epoch)) {
              setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: false }));
            }
          }
        });

        if (loadedFollowersByAddressRef.current[key]) return;
      }

      if (!params.provider) return;

      await runInFlight(followersInFlightRef.current, key, async () => {
        if (isStale(epoch)) return;
        setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();
          const provider = params.provider;
          if (!provider) return;

          const active = await withTimeout(
            scanActiveFollowAddresses({
            readContract,
            scanProvider: provider,
            iface: socialInterface,
            followedFilter: readContract.filters.Followed(null, address),
            unfollowedFilter: readContract.filters.Unfollowed(null, address),
            addressArgIndex: 0,
            maxEvents: 7_500,
            errorLabel: "follower"
            }),
            8_000,
            "followers scan"
          );

          const normalizedActive = (active ?? []).map((a) => String(a ?? "").trim().toLowerCase()).filter(Boolean);
          if (isStale(epoch)) return;
          setFollowersByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
          setFollowerCountByAddress((prev) => ({ ...prev, [key]: normalizedActive.length }));
          loadedFollowersByAddressRef.current[key] = true;
          loadedFollowerCountByAddressRef.current[key] = true;
        } catch (err) {
          if (!isStale(epoch)) {
            setStatusFromError(params.setStatus, err as ErrorInput);
          }
        } finally {
          if (!isStale(epoch)) {
            setIsLoadingFollowersByAddress((prev) => ({ ...prev, [key]: false }));
          }
        }
      });
    },
    [
      params.provider,
      params.chainId,
      params.ensureContractDeployedOnCurrentNetwork,
      params.getReadContract,
      params.setStatus,
      loadFollowBundleForAddress
    ]
  );

  const loadFollowingForAddress = useCallback(
    async (address: string) => {
      if (!address) return;
      const key = addressKey(address);
      const epoch = snapshotEpoch();

      if (loadedFollowingByAddressRef.current[key]) return;

      // Avoid slow RPC scans before chainId is known.
      if (!params.chainId) return;

      const env = getEnv();
      const chainIdNum = parseChainIdNumber(params.chainId);
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (subgraphUrl) {
        await loadFollowBundleForAddress(address, epoch);
        if (loadedFollowingByAddressRef.current[key]) return;

        await runInFlight(followingInFlightRef.current, key, async () => {
          if (isStale(epoch)) return;
          setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: true }));
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

            const result = await tryQuerySubgraph<{ followEdges: Array<{ followee?: { id?: string } | null }> }>({
              url: subgraphUrl,
              query,
              variables: { follower: key, first: 1000 },
              timeoutMs: 12_000
            });

            if (result.ok) {
              if (isStale(epoch)) return;
              const normalizedActive = (Array.isArray(result.data?.followEdges) ? result.data.followEdges : [])
                .map((e) => String(e?.followee?.id ?? "").trim().toLowerCase())
              .filter(Boolean);

              setFollowingByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
              loadedFollowingByAddressRef.current[key] = true;
            } else {
              // eslint-disable-next-line no-console
              console.warn("Following subgraph query failed; falling back to RPC scan", {
                chainId: params.chainId,
                address: key,
                subgraphUrl,
                err: result.error
              });
            }
          } catch {
            // fall back to on-chain scan
          } finally {
            if (!isStale(epoch)) {
              setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: false }));
            }
          }
        });

        if (loadedFollowingByAddressRef.current[key]) return;
      }

      if (!params.provider) return;

      await runInFlight(followingInFlightRef.current, key, async () => {
        if (isStale(epoch)) return;
        setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: true }));
        try {
          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();
          const provider = params.provider;
          if (!provider) return;

          const active = await withTimeout(
            scanActiveFollowAddresses({
            readContract,
            scanProvider: provider,
            iface: socialInterface,
            followedFilter: readContract.filters.Followed(address, null),
            unfollowedFilter: readContract.filters.Unfollowed(address, null),
            addressArgIndex: 1,
            maxEvents: 7_500,
            errorLabel: "following"
            }),
            8_000,
            "following scan"
          );

          const normalizedActive = (active ?? []).map((a) => String(a ?? "").trim().toLowerCase()).filter(Boolean);
          if (isStale(epoch)) return;
          setFollowingByAddress((prev) => ({ ...prev, [key]: normalizedActive }));
          loadedFollowingByAddressRef.current[key] = true;
        } catch (err) {
          if (!isStale(epoch)) {
            setStatusFromError(params.setStatus, err as ErrorInput);
          }
        } finally {
          if (!isStale(epoch)) {
            setIsLoadingFollowingByAddress((prev) => ({ ...prev, [key]: false }));
          }
        }
      });
    },
    [
      params.provider,
      params.chainId,
      params.ensureContractDeployedOnCurrentNetwork,
      params.getReadContract,
      params.setStatus,
      loadFollowBundleForAddress
    ]
  );

  const applyFollowUpdate = useCallback(
    (args: { follower: string; followee: string; isFollowing: boolean }) => {
      const followerKey = addressKey(args.follower);
      const followeeKey = addressKey(args.followee);
      if (!followerKey || !followeeKey) return;

      setFollowingByAddress((prev) => {
        const existing = prev[followerKey] ?? [];
        const has = existing.includes(followeeKey);
        const nextList = args.isFollowing
          ? has
            ? existing
            : [...existing, followeeKey]
          : existing.filter((addr) => addr !== followeeKey);
        if (nextList === existing) return prev;
        return { ...prev, [followerKey]: nextList };
      });

      setFollowersByAddress((prev) => {
        const existing = prev[followeeKey] ?? [];
        const has = existing.includes(followerKey);
        const nextList = args.isFollowing
          ? has
            ? existing
            : [...existing, followerKey]
          : existing.filter((addr) => addr !== followerKey);
        if (nextList === existing) return prev;
        return { ...prev, [followeeKey]: nextList };
      });

      setFollowerCountByAddress((prev) => {
        const current = prev[followeeKey];
        if (typeof current !== "number") return prev;
        const delta = args.isFollowing ? 1 : -1;
        const nextCount = Math.max(0, current + delta);
        if (nextCount === current) return prev;
        return { ...prev, [followeeKey]: nextCount };
      });
    },
    [params.chainId]
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
    loadFollowingForAddress,
    applyFollowUpdate
  };
}
