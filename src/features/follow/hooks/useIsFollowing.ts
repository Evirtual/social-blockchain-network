import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@shared/lib/errors";
import { runInFlight } from "@shared/lib/inFlight";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { addressKey } from "./utils";
import { getEnv } from "@shared/lib/env";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import type { ChainProvider, ReadContractFactory, WriteContractFactory } from "@features/contract";

export function useIsFollowing(params: {
  provider: ChainProvider | null;
  chainId: string | null;
  walletAddress: string | null;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;
  runContractTx: <T>(
    label: string,
    send: () => Promise<TransactionResponse>,
    onReceipt?: (receipt: TransactionReceipt) => Promise<T> | T
  ) => Promise<T | undefined>;
  setStatus: (v: string) => void;
}) {
  const [isFollowingByAddress, setIsFollowingByAddress] = useState<Record<string, boolean | undefined>>({});
  const isFollowingByAddressRef = useRef<Record<string, boolean | undefined>>({});
  const loadedIsFollowingByAddressRef = useRef<Record<string, boolean>>({});
  const isFollowingInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  useEffect(() => {
    setIsFollowingByAddress({});
    isFollowingByAddressRef.current = {};
    loadedIsFollowingByAddressRef.current = {};
    isFollowingInFlightRef.current = {};
  }, [params.walletAddress, params.chainId]);

  useEffect(() => {
    isFollowingByAddressRef.current = isFollowingByAddress;
  }, [isFollowingByAddress]);

  const loadIsFollowing = useCallback(
    async (followee: string) => {
      try {
        if (!params.provider) return;
        if (!params.walletAddress) return;
        if (!followee) return;
        const key = addressKey(followee);

        if (loadedIsFollowingByAddressRef.current[key]) return;
        if (typeof isFollowingByAddressRef.current[key] === "boolean") {
          loadedIsFollowingByAddressRef.current[key] = true;
          return;
        }

        await runInFlight(isFollowingInFlightRef.current, key, async () => {
          const env = getEnv();
          const chainIdNum = parseChainIdNumber(params.chainId);
          const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);

          if (subgraphUrl) {
            try {
              const query = `
                query IsFollowing($follower: ID!, $followee: ID!) {
                  followEdges(first: 1, where: { follower: $follower, followee: $followee }) {
                    active
                  }
                }
              `;

              const data = await querySubgraph<{ followEdges: Array<{ active?: boolean } | null> }>({
                url: subgraphUrl,
                query,
                variables: {
                  follower: String(params.walletAddress).toLowerCase(),
                  followee: String(followee).toLowerCase()
                },
                timeoutMs: 8_000
              });

              const active = Boolean((Array.isArray(data?.followEdges) ? data.followEdges : [])[0]?.active);
              setIsFollowingByAddress((prev) => {
                const next = { ...prev, [key]: active };
                isFollowingByAddressRef.current = next;
                return next;
              });
              loadedIsFollowingByAddressRef.current[key] = true;
              return;
            } catch {
              // fall back to on-chain read
            }
          }

          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();
          const ok = (await readContract.isFollowing(params.walletAddress, followee)) as boolean;
          setIsFollowingByAddress((prev) => {
            const next = { ...prev, [key]: !!ok };
            isFollowingByAddressRef.current = next;
            return next;
          });
          loadedIsFollowingByAddressRef.current[key] = true;
        });
      } catch {
        // ignore
      }
    },
    [params.provider, params.walletAddress, params.ensureContractDeployedOnCurrentNetwork, params.getReadContract]
  );

  const toggleFollow = useCallback(
    async (followee: string): Promise<boolean | undefined> => {
      try {
        if (!params.walletAddress) {
          requestConnectNudge();
          params.setStatus("Connect your wallet first.");
          return undefined;
        }
        if (!followee) return;
        if (addressKey(followee) === addressKey(params.walletAddress)) {
          params.setStatus("You cannot follow yourself.");
          return undefined;
        }

        const writeContract = await params.getWriteContract();
        const key = addressKey(followee);

        let currently = isFollowingByAddressRef.current[key];
        if (typeof currently !== "boolean") {
          currently = (await writeContract.isFollowing(params.walletAddress, followee)) as boolean;
        }

        const ok = await params.runContractTx<boolean>(
          currently ? "Unfollow" : "Follow",
          () => (currently ? writeContract.unfollow(followee) : writeContract.follow(followee)),
          () => true
        );
        if (!ok) return undefined;
        const nextValue = !currently;

        setIsFollowingByAddress((prev) => {
          const next = { ...prev, [key]: nextValue };
          isFollowingByAddressRef.current = next;
          return next;
        });
        return nextValue;
      } catch (error) {
        params.setStatus(getErrorMessage(error));
        return undefined;
      }
    },
    [params.walletAddress, params.getWriteContract, params.runContractTx, params.setStatus]
  );

  return {
    isFollowingByAddress,
    loadIsFollowing,
    toggleFollow,
    setIsFollowingByAddress
  };
}
