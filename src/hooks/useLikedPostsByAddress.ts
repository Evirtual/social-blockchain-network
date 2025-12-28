import { useCallback, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";
import { getSocialContract, socialInterface } from "../contracts/socialPosts";
import { getErrorMessage } from "../lib/errors";
import { getRpcProvider, getRpcUrlForChainId, parseChainIdNumber } from "../lib/rpc";
import { parseChainKey } from "../lib/chainKey";
import { readSessionTokenIds, writeSessionTokenIds } from "../lib/sessionTokenCache";
import { scanToggleEventsForAddress } from "../lib/toggleEventScanner";
import { runInFlight } from "../lib/inFlight";
import { getScanProviderFromReadContract } from "../lib/contractRunner";

type Args = {
  walletProvider: BrowserProvider | null;
  chainId: string | null;

  contractAddress: string | undefined;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;

  loadPostsByTokenIds: (tokenIds: string[]) => Promise<void>;
  setStatus: (status: string) => void;
};

const LIKES_SESSION_CACHE_PREFIX = "likesTokenKeysByAddress:";

export function useLikedPostsByAddress(args: Args) {
  const [likedTokenIdsByAddress, setLikedTokenIdsByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingLikesByAddress, setIsLoadingLikesByAddress] = useState<Record<string, boolean>>({});

  const likesInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const likesLoadedByKeyRef = useRef<Record<string, boolean>>({});

  const toggleLikedKey = useCallback(
    (addressLower: string, chainId: string | null, tokenId: string) => {
      const key = addressLower.trim().toLowerCase();
      if (!key) return;

      const chainKey = parseChainKey(chainId);
      const likedKey = chainKey ? `${chainKey}:${tokenId}` : tokenId;

      setLikedTokenIdsByAddress((prev) => {
        const current = prev[key] ?? [];
        const has = current.includes(likedKey);
        const next = has ? current.filter((id) => id !== likedKey) : [likedKey, ...current];
        writeSessionTokenIds(LIKES_SESSION_CACHE_PREFIX, key, next);
        return { ...prev, [key]: next };
      });
    },
    []
  );

  const loadLikesForAddress = useCallback(
    async (address: string) => {
      try {
        if (!address) return;

        const key = address.toLowerCase();

        // Avoid re-scanning once we have successfully loaded likes for this address on this network.
        const networkKey = String(args.chainId ?? args.contractAddress ?? "").toLowerCase();
        const loadedKey = `${networkKey}:${key}`;
        if (loadedKey && likesLoadedByKeyRef.current[loadedKey]) return;

        const cached = readSessionTokenIds(LIKES_SESSION_CACHE_PREFIX, key);
        if (cached !== null) {
          setLikedTokenIdsByAddress((prev) => ({ ...prev, [key]: cached }));
          likesLoadedByKeyRef.current[loadedKey] = true;
          return;
        }

        await runInFlight(likesInFlightRef.current, key, async () => {
          setIsLoadingLikesByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const env = import.meta.env as any;
            const resolvedChainIdNum = parseChainIdNumber(args.chainId);
            const rpcUrl = getRpcUrlForChainId(env, resolvedChainIdNum);

            let readContract: any = null;
            let scanProvider: any = null;

            if (rpcUrl && args.contractAddress) {
              const rpcProvider: any = getRpcProvider(rpcUrl, resolvedChainIdNum!);
              readContract = getSocialContract(args.contractAddress, rpcProvider);
              scanProvider = rpcProvider;
            } else {
              if (!args.walletProvider) return;
              await args.ensureContractDeployedOnCurrentNetwork();
              readContract = await args.getReadContract();

              scanProvider = getScanProviderFromReadContract(readContract, args.walletProvider);
            }

            const activeTokenIds = await scanToggleEventsForAddress({
              readContract,
              scanProvider,
              iface: socialInterface,
              address,
              onFilter: (readContract as any).filters.PostLiked(address, null),
              offFilter: (readContract as any).filters.PostUnliked(address, null),
              onEventName: "PostLiked",
              offEventName: "PostUnliked",
              tokenIdArgIndex: 1
            });

            const chainKey = parseChainKey(args.chainId);
            const activeKeys = chainKey ? activeTokenIds.map((id) => `${chainKey}:${id}`) : activeTokenIds;

            setLikedTokenIdsByAddress((prev) => {
              const existingLikes = prev[key] ?? [];
              const preserved = chainKey ? existingLikes.filter((k) => !k.startsWith(`${chainKey}:`)) : existingLikes;
              const merged = Array.from(new Set([...activeKeys, ...preserved]));
              writeSessionTokenIds(LIKES_SESSION_CACHE_PREFIX, key, merged);
              return { ...prev, [key]: merged };
            });

            await args.loadPostsByTokenIds(activeTokenIds);

            likesLoadedByKeyRef.current[loadedKey] = true;
          } finally {
            setIsLoadingLikesByAddress((prev) => ({ ...prev, [key]: false }));
          }
        });
      } catch (err) {
        args.setStatus(getErrorMessage(err));
      }
    },
    [
      args.walletProvider,
      args.chainId,
      args.contractAddress,
      args.ensureContractDeployedOnCurrentNetwork,
      args.getReadContract,
      args.loadPostsByTokenIds,
      args.setStatus
    ]
  );

  return {
    likedTokenIdsByAddress,
    isLoadingLikesByAddress,
    loadLikesForAddress,
    toggleLikedKey
  };
}
