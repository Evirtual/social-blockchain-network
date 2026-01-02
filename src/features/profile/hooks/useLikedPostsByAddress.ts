import { useCallback, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";
import { getSocialContract, socialInterface, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";
import { getErrorMessage } from "@shared/lib/errors";
import { getRpcProvider, getRpcUrlForChainId, parseChainIdNumber } from "@shared/lib/rpc";
import { parseChainKey } from "@shared/lib/chainKey";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";
import { scanToggleEventsForAddress } from "../services/toggleEventScanner";
import { runInFlight } from "@shared/lib/inFlight";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { getEnv } from "@shared/lib/env";

type Args = {
  walletProvider: BrowserProvider | null;
  chainId: string | null;

  contractAddress: string | undefined;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;

  loadPostsByTokenIds: (tokenIds: string[]) => Promise<void>;
  setStatus: (status: string) => void;
};

export function useLikedPostsByAddress(args: Args) {
  const [likedTokenIdsByAddress, setLikedTokenIdsByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingLikesByAddress, setIsLoadingLikesByAddress] = useState<Record<string, boolean>>({});

  const likesInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const likesLoadedByKeyRef = useRef<Record<string, boolean>>({});

  const toggleLikedKey = useCallback((addressLower: string, chainId: string | null, tokenId: string) => {
    const key = addressLower.trim().toLowerCase();
    if (!key) return;

    const chainKey = parseChainKey(chainId);
    const likedKey = chainKey ? `${chainKey}:${tokenId}` : tokenId;

    setLikedTokenIdsByAddress((prev) => {
      const current = prev[key] ?? [];
      const has = current.includes(likedKey);
      const next = has ? current.filter((id) => id !== likedKey) : [likedKey, ...current];
      return { ...prev, [key]: next };
    });
  }, []);

  const loadLikesForAddress = useCallback(
    async (address: string) => {
      try {
        if (!address) return;

        const key = address.toLowerCase();

        // Avoid re-scanning once we have successfully loaded likes for this address on this network.
        const networkKey = String(args.chainId ?? args.contractAddress ?? "").toLowerCase();
        const loadedKey = `${networkKey}:${key}`;
        if (loadedKey && likesLoadedByKeyRef.current[loadedKey]) return;

        await runInFlight(likesInFlightRef.current, key, async () => {
          setIsLoadingLikesByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const env = getEnv();
            const resolvedChainIdNum = parseChainIdNumber(args.chainId);

            const subgraphUrl = getSubgraphUrlForChainId(env, resolvedChainIdNum);
            if (subgraphUrl) {
              try {
                const query = `
                  query AccountLikes($account: ID!, $first: Int!) {
                    likeEdges(
                      first: $first,
                      where: { account: $account, active: true },
                      orderBy: updatedAtBlock,
                      orderDirection: desc
                    ) {
                      tokenId
                    }
                  }
                `;

                const data = await querySubgraph<{ likeEdges: Array<{ tokenId: string }> }>({
                  url: subgraphUrl,
                  query,
                  variables: { account: key, first: 1000 },
                  timeoutMs: 10_000
                });

                const tokenIds = (Array.isArray(data?.likeEdges) ? data.likeEdges : [])
                  .map((e) => String(e?.tokenId ?? "").trim())
                  .filter(Boolean);

                const chainKey = parseChainKey(args.chainId);
                const activeKeys = chainKey ? tokenIds.map((id) => `${chainKey}:${id}`) : tokenIds;

                setLikedTokenIdsByAddress((prev) => {
                  const existingLikes = prev[key] ?? [];
                  const preserved = chainKey
                    ? existingLikes.filter((k) => !k.startsWith(`${chainKey}:`))
                    : existingLikes;
                  const merged = Array.from(new Set([...activeKeys, ...preserved]));
                  return { ...prev, [key]: merged };
                });

                await args.loadPostsByTokenIds(tokenIds);

                likesLoadedByKeyRef.current[loadedKey] = true;
                return;
              } catch {
                // If the subgraph is warming up or unavailable, fall back to on-chain scanning.
              }
            }

            const rpcUrl = getRpcUrlForChainId(env, resolvedChainIdNum);

            let readContract: SocialPostsContract | null = null;
            let scanProvider: ChainProvider | null = null;

            if (rpcUrl && args.contractAddress) {
              const rpcProvider = getRpcProvider(rpcUrl, resolvedChainIdNum!);
              readContract = getSocialContract(args.contractAddress, rpcProvider);
              scanProvider = rpcProvider;
            } else {
              if (!args.walletProvider) return;
              await args.ensureContractDeployedOnCurrentNetwork();
              readContract = await args.getReadContract();

              scanProvider = getScanProviderFromReadContract(readContract, args.walletProvider);
            }

            if (!readContract || !scanProvider) return;

            const activeTokenIds = await scanToggleEventsForAddress({
              readContract,
              scanProvider,
              iface: socialInterface,
              address,
              onFilter: readContract.filters.PostLiked(address, null),
              offFilter: readContract.filters.PostUnliked(address, null),
              onEventName: "PostLiked",
              offEventName: "PostUnliked",
              tokenIdArgIndex: 1
            });

            const chainKey = parseChainKey(args.chainId);
            const activeKeys = chainKey ? activeTokenIds.map((id) => `${chainKey}:${id}`) : activeTokenIds;

            setLikedTokenIdsByAddress((prev) => {
              const existingLikes = prev[key] ?? [];
              const preserved = chainKey
                ? existingLikes.filter((k) => !k.startsWith(`${chainKey}:`))
                : existingLikes;
              const merged = Array.from(new Set([...activeKeys, ...preserved]));
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
