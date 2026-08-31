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
import type { Dispatch, SetStateAction } from "react";
import type { ChainProvider, ReadContractFactory } from "@features/contract/types";

type LoadingSetter = Dispatch<SetStateAction<Record<string, boolean>>>;
type LoadedRef = { current: Record<string, boolean> };
type InFlightRef = { current: Record<string, Promise<void> | null> };

/** followers: who follows this address. following: who this address follows. */
type FollowDirection = "followers" | "following";

const EDGE_PAGE_SIZE = 1_000;
const EDGE_QUERY_TIMEOUT_MS = 12_000;
const COUNT_QUERY_TIMEOUT_MS = 10_000;
const SCAN_TIMEOUT_MS = 8_000;

/**
 * The two directions differ only in which side of the edge is matched and which
 * is read back, so one template covers both. The variable is named `id` rather
 * than after the side, which is what let the two queries collapse into this.
 */
function buildFollowEdgeQuery(operation: string, matchSide: string, selectSide: string) {
  return `
    query ${operation}($id: ID!, $first: Int!) {
      followEdges(
        first: $first,
        where: { ${matchSide}: $id, active: true },
        orderBy: updatedAtBlock,
        orderDirection: desc
      ) {
        ${selectSide} {
          id
        }
      }
    }
  `;
}

function normalizeAddresses(values: ReadonlyArray<unknown> | null | undefined): string[] {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
}

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

  /**
   * Every scan below shares this skeleton: de-duplicate by key, decline if the
   * epoch has already moved on, mark loading, and clear it whatever happens.
   *
   * Marking has to be as guarded as clearing. This body runs at least a
   * microtask after the epoch was snapshotted - often a whole subgraph round
   * trip later - so a chain change can land in between. An unguarded mark then
   * wrote the flag back as true after the reset had cleared it, while the
   * finally saw a stale epoch and declined to clear it, stranding a skeleton on
   * screen for good. Centralised here so there is one copy of it to get right.
   *
   * The body owns its own error handling: what counts as recoverable differs
   * between a subgraph miss, which falls back to a scan, and a failed scan,
   * which is reported.
   */
  const runGuardedScan = useCallback(
    async (args: {
      inFlightRef: InFlightRef;
      key: string;
      epoch: number;
      setLoadings: LoadingSetter[];
      body: () => Promise<void>;
    }) => {
      const mark = (value: boolean) => {
        for (const setLoading of args.setLoadings) {
          setLoading((prev) => ({ ...prev, [args.key]: value }));
        }
      };

      await runInFlight(args.inFlightRef.current, args.key, async () => {
        if (isStale(args.epoch)) return;
        mark(true);
        try {
          await args.body();
        } finally {
          if (!isStale(args.epoch)) mark(false);
        }
      });
    },
    [isStale]
  );

  /** The subgraph URL for the wallet's chain, or null when there is not one. */
  const getSubgraphUrl = useCallback(() => {
    if (!params.chainId) return null;
    return getSubgraphUrlForChainId(getEnv(), parseChainIdNumber(params.chainId)) ?? null;
  }, [params.chainId]);

  /**
   * One query for all three answers. Worth trying first because the profile
   * card asks for followers, following and the count together, and this saves
   * three round trips.
   */
  const loadFollowBundleForAddress = useCallback(
    async (address: string, epoch: number) => {
      if (!address) return;
      const key = addressKey(address);
      if (!key) return;

      if (loadedFollowBundleByAddressRef.current[key]) return;
      const subgraphUrl = getSubgraphUrl();
      if (!subgraphUrl) return;

      await runGuardedScan({
        inFlightRef: followBundleInFlightRef,
        key,
        epoch,
        setLoadings: [
          setIsLoadingFollowerCountByAddress,
          setIsLoadingFollowersByAddress,
          setIsLoadingFollowingByAddress
        ],
        body: async () => {
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
            variables: { id: key, first: EDGE_PAGE_SIZE },
            timeoutMs: EDGE_QUERY_TIMEOUT_MS
          });

          if (!result.ok) return;
          if (isStale(epoch)) return;

          const followers = normalizeAddresses(result.data?.followersEdges?.map((e) => e?.follower?.id));
          const following = normalizeAddresses(result.data?.followingEdges?.map((e) => e?.followee?.id));

          const countRaw = Number(result.data?.account?.followersCount ?? NaN);
          const count = Number.isFinite(countRaw) ? countRaw : followers.length;

          setFollowerCountByAddress((prev) => ({ ...prev, [key]: count }));
          setFollowersByAddress((prev) => ({ ...prev, [key]: followers }));
          setFollowingByAddress((prev) => ({ ...prev, [key]: following }));

          loadedFollowerCountByAddressRef.current[key] = true;
          loadedFollowersByAddressRef.current[key] = true;
          loadedFollowingByAddressRef.current[key] = true;
          loadedFollowBundleByAddressRef.current[key] = true;
        }
      });
    },
    [
      getSubgraphUrl,
      isStale,
      runGuardedScan,
      setIsLoadingFollowerCountByAddress,
      setIsLoadingFollowersByAddress,
      setIsLoadingFollowingByAddress
    ]
  );

  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const isInitial = lastChainIdRef.current === undefined;
    if (params.chainId === lastChainIdRef.current) return;
    lastChainIdRef.current = params.chainId;
    if (isInitial) return;

    // The loading maps are cleared by the guard itself, on the bump.
    bumpEpoch();
    loadedFollowerCountByAddressRef.current = {};
    loadedFollowersByAddressRef.current = {};
    loadedFollowingByAddressRef.current = {};
    loadedFollowBundleByAddressRef.current = {};

    followBundleInFlightRef.current = {};
    followerCountInFlightRef.current = {};
    followersInFlightRef.current = {};
    followingInFlightRef.current = {};

    setFollowerCountByAddress({});
    setFollowersByAddress({});
    setFollowingByAddress({});
  }, [params.chainId, bumpEpoch]);

  /**
   * Shared by both directions. They differ in which side of the edge they read,
   * which event argument identifies the counterparty, and - for followers only -
   * that the list length doubles as the follower count.
   */
  const loadFollowEdgesForAddress = useCallback(
    async (address: string, direction: FollowDirection) => {
      if (!address) return;
      const key = addressKey(address);
      const epoch = snapshotEpoch();

      const isFollowers = direction === "followers";
      const loadedRef: LoadedRef = isFollowers ? loadedFollowersByAddressRef : loadedFollowingByAddressRef;
      const inFlightRef: InFlightRef = isFollowers ? followersInFlightRef : followingInFlightRef;
      const setIsLoading = isFollowers ? setIsLoadingFollowersByAddress : setIsLoadingFollowingByAddress;
      const setList = isFollowers ? setFollowersByAddress : setFollowingByAddress;
      const operation = isFollowers ? "Followers" : "Following";

      if (loadedRef.current[key]) return;

      // Avoid slow RPC scans before chainId is known.
      if (!params.chainId) return;

      /** Followers also answer the count, since it is the length of the list. */
      const commit = (list: string[]) => {
        setList((prev) => ({ ...prev, [key]: list }));
        loadedRef.current[key] = true;
        if (!isFollowers) return;
        setFollowerCountByAddress((prev) => ({ ...prev, [key]: list.length }));
        loadedFollowerCountByAddressRef.current[key] = true;
      };

      const subgraphUrl = getSubgraphUrl();
      if (subgraphUrl) {
        await loadFollowBundleForAddress(address, epoch);
        if (loadedRef.current[key]) return;

        await runGuardedScan({
          inFlightRef,
          key,
          epoch,
          setLoadings: [setIsLoading],
          body: async () => {
            try {
              const result = await tryQuerySubgraph<{
                followEdges: Array<Record<string, { id?: string } | null | undefined>>;
              }>({
                url: subgraphUrl,
                query: buildFollowEdgeQuery(
                  operation,
                  isFollowers ? "followee" : "follower",
                  isFollowers ? "follower" : "followee"
                ),
                variables: { id: key, first: EDGE_PAGE_SIZE },
                timeoutMs: EDGE_QUERY_TIMEOUT_MS
              });

              if (!result.ok) {
                // eslint-disable-next-line no-console
                console.warn(`${operation} subgraph query failed; falling back to RPC scan`, {
                  chainId: params.chainId,
                  address: key,
                  subgraphUrl,
                  err: result.error
                });
                return;
              }

              if (isStale(epoch)) return;
              const side = isFollowers ? "follower" : "followee";
              commit(normalizeAddresses(result.data?.followEdges?.map((e) => e?.[side]?.id)));
            } catch {
              // fall back to on-chain scan
            }
          }
        });

        if (loadedRef.current[key]) return;
      }

      if (!params.provider) return;

      await runGuardedScan({
        inFlightRef,
        key,
        epoch,
        setLoadings: [setIsLoading],
        body: async () => {
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
                followedFilter: isFollowers
                  ? readContract.filters.Followed(null, address)
                  : readContract.filters.Followed(address, null),
                unfollowedFilter: isFollowers
                  ? readContract.filters.Unfollowed(null, address)
                  : readContract.filters.Unfollowed(address, null),
                addressArgIndex: isFollowers ? 0 : 1,
                maxEvents: 7_500,
                errorLabel: isFollowers ? "follower" : "following"
              }),
              SCAN_TIMEOUT_MS,
              `${direction} scan`
            );

            if (isStale(epoch)) return;
            commit(normalizeAddresses(active));
          } catch (err) {
            if (!isStale(epoch)) {
              setStatusFromError(params.setStatus, err as ErrorInput);
            }
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
      snapshotEpoch,
      isStale,
      getSubgraphUrl,
      runGuardedScan,
      loadFollowBundleForAddress,
      setIsLoadingFollowersByAddress,
      setIsLoadingFollowingByAddress
    ]
  );

  const loadFollowersForAddress = useCallback(
    (address: string) => loadFollowEdgesForAddress(address, "followers"),
    [loadFollowEdgesForAddress]
  );

  const loadFollowingForAddress = useCallback(
    (address: string) => loadFollowEdgesForAddress(address, "following"),
    [loadFollowEdgesForAddress]
  );

  /**
   * Only the count, for the places that show it without the list. Reads the
   * stored total rather than paging the edges, so it stays a single small query.
   */
  const loadFollowerCountForAddress = useCallback(
    async (address: string) => {
      if (!address) return;
      const key = addressKey(address);
      const epoch = snapshotEpoch();

      if (loadedFollowerCountByAddressRef.current[key]) return;

      // Avoid slow RPC scans before chainId is known.
      if (!params.chainId) return;

      const subgraphUrl = getSubgraphUrl();
      if (subgraphUrl) {
        await loadFollowBundleForAddress(address, epoch);
        if (loadedFollowerCountByAddressRef.current[key]) return;

        await runGuardedScan({
          inFlightRef: followerCountInFlightRef,
          key,
          epoch,
          setLoadings: [setIsLoadingFollowerCountByAddress],
          body: async () => {
            try {
              const result = await tryQuerySubgraph<{ account: { followersCount?: string } | null }>({
                url: subgraphUrl,
                query: `
                  query FollowerCount($id: ID!) {
                    account(id: $id) {
                      followersCount
                    }
                  }
                `,
                variables: { id: key },
                timeoutMs: COUNT_QUERY_TIMEOUT_MS
              });

              if (!result.ok) {
                // eslint-disable-next-line no-console
                console.warn("FollowerCount subgraph query failed; falling back to RPC scan", {
                  chainId: params.chainId,
                  address: key,
                  subgraphUrl,
                  err: result.error
                });
                return;
              }

              if (isStale(epoch)) return;
              const count = Number(result.data?.account?.followersCount ?? 0);
              setFollowerCountByAddress((prev) => ({ ...prev, [key]: Number.isFinite(count) ? count : 0 }));
              loadedFollowerCountByAddressRef.current[key] = true;
            } catch {
              // fall back to on-chain scan
            }
          }
        });

        if (loadedFollowerCountByAddressRef.current[key]) return;
      }

      if (!params.provider) return;

      await runGuardedScan({
        inFlightRef: followerCountInFlightRef,
        key,
        epoch,
        setLoadings: [setIsLoadingFollowerCountByAddress],
        body: async () => {
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
              SCAN_TIMEOUT_MS,
              "follower scan"
            );

            if (isStale(epoch)) return;
            setFollowerCountByAddress((prev) => ({ ...prev, [key]: activeFollowers.length }));
            loadedFollowerCountByAddressRef.current[key] = true;
          } catch (err) {
            if (!isStale(epoch)) {
              setStatusFromError(params.setStatus, err as ErrorInput);
            }
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
      snapshotEpoch,
      isStale,
      getSubgraphUrl,
      runGuardedScan,
      loadFollowBundleForAddress,
      setIsLoadingFollowerCountByAddress
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
