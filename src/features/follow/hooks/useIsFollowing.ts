import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@shared/lib/errors";
import { runInFlight } from "@shared/lib/inFlight";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { addressKey } from "./utils";

export function useIsFollowing(params: {
  provider: unknown | null;
  walletAddress: string | null;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
  getWriteContract: () => Promise<any>;
  runContractTx: <T>(
    label: string,
    send: () => Promise<any>,
    onReceipt?: (receipt: any) => Promise<T> | T
  ) => Promise<T | undefined>;
  setStatus: (v: string) => void;
}) {
  const [isFollowingByAddress, setIsFollowingByAddress] = useState<Record<string, boolean | undefined>>({});
  const loadedIsFollowingByAddressRef = useRef<Record<string, boolean>>({});
  const isFollowingInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  useEffect(() => {
    setIsFollowingByAddress({});
    loadedIsFollowingByAddressRef.current = {};
    isFollowingInFlightRef.current = {};
  }, [params.walletAddress]);

  const loadIsFollowing = useCallback(
    async (followee: string) => {
      try {
        if (!params.provider) return;
        if (!params.walletAddress) return;
        if (!followee) return;
        const key = addressKey(followee);

        if (loadedIsFollowingByAddressRef.current[key]) return;
        if (typeof isFollowingByAddress[key] === "boolean") {
          loadedIsFollowingByAddressRef.current[key] = true;
          return;
        }

        await runInFlight(isFollowingInFlightRef.current, key, async () => {
          await params.ensureContractDeployedOnCurrentNetwork();
          const readContract = await params.getReadContract();
          const ok = (await (readContract as any).isFollowing(params.walletAddress, followee)) as boolean;
          setIsFollowingByAddress((prev) => ({ ...prev, [key]: !!ok }));
          loadedIsFollowingByAddressRef.current[key] = true;
        });
      } catch {
        // ignore
      }
    },
    [
      params.provider,
      params.walletAddress,
      params.ensureContractDeployedOnCurrentNetwork,
      params.getReadContract,
      isFollowingByAddress
    ]
  );

  const toggleFollow = useCallback(
    async (followee: string) => {
      try {
        if (!params.walletAddress) {
          requestConnectNudge();
          params.setStatus("Connect your wallet first.");
          return;
        }
        if (!followee) return;
        if (addressKey(followee) === addressKey(params.walletAddress)) {
          params.setStatus("You cannot follow yourself.");
          return;
        }

        const writeContract = await params.getWriteContract();
        const key = addressKey(followee);

        let currently = isFollowingByAddress[key];
        if (typeof currently !== "boolean") {
          currently = (await (writeContract as any).isFollowing(params.walletAddress, followee)) as boolean;
        }

        const ok = await params.runContractTx<boolean>(
          currently ? "Unfollow" : "Follow",
          () =>
            ((currently
              ? (writeContract as any).unfollow(followee)
              : (writeContract as any).follow(followee)) as any),
          () => true
        );
        if (!ok) return;

        setIsFollowingByAddress((prev) => ({ ...prev, [key]: !currently }));
      } catch (error) {
        params.setStatus(getErrorMessage(error));
      }
    },
    [params.walletAddress, params.getWriteContract, params.runContractTx, params.setStatus, isFollowingByAddress]
  );

  return {
    isFollowingByAddress,
    loadIsFollowing,
    toggleFollow,
    setIsFollowingByAddress
  };
}
