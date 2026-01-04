import { useCallback, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";
import { getSocialContract, socialInterface, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { getRpcProvider, getRpcUrlForChainId, parseChainIdNumber } from "@shared/lib/rpc";
import { parseChainKey } from "@shared/lib/chainKey";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";
import { scanToggleEventsForAddress } from "../services/toggleEventScanner";
import { runInFlight } from "@shared/lib/inFlight";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { getEnv } from "@shared/lib/env";
import type { LoadPostsByTokenIdsResult } from "@features/feed/providers/feedStateContext";

type Args = {
  walletProvider: BrowserProvider | null;
  chainId: string | null;
  selectedNetworkChainIds: string[];

  contractAddress: string | undefined;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;

  loadPostsByTokenIds: (tokenIds: string[], postChainId?: string | null) => Promise<LoadPostsByTokenIdsResult>;
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

        const selectedIds = Array.isArray(args.selectedNetworkChainIds) ? args.selectedNetworkChainIds : [];
        if (selectedIds.length === 0) return;

        await runInFlight(likesInFlightRef.current, key, async () => {
          setIsLoadingLikesByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const env = getEnv();
            const likeEdgesQuery = `
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

            for (const selectedChainId of selectedIds) {
              const chainIdStr = String(selectedChainId ?? "").trim();
              if (!chainIdStr) continue;

              const chainIdNum = parseChainIdNumber(chainIdStr);
              const networkKey = chainIdStr.toLowerCase();
              const loadedKey = `${networkKey}:${key}`;
              if (likesLoadedByKeyRef.current[loadedKey]) continue;

              const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
              if (subgraphUrl) {
                try {
                  const data = await querySubgraph<{ likeEdges: Array<{ tokenId: string }> }>({
                    url: subgraphUrl,
                    query: likeEdgesQuery,
                    variables: { account: key, first: 1000 },
                    timeoutMs: 10_000
                  });

                  const tokenIds = (Array.isArray(data?.likeEdges) ? data.likeEdges : [])
                    .map((e) => String(e?.tokenId ?? "").trim())
                    .filter(Boolean);

                  const chainKey = parseChainKey(chainIdStr);
                  const activeKeys = chainKey ? tokenIds.map((id) => `${chainKey}:${id}`) : tokenIds;

                  setLikedTokenIdsByAddress((prev) => {
                    const existingLikes = prev[key] ?? [];
                    const preserved = chainKey
                      ? existingLikes.filter((k) => !k.startsWith(`${chainKey}:`))
                      : existingLikes;
                    const merged = Array.from(new Set([...activeKeys, ...preserved]));
                    return { ...prev, [key]: merged };
                  });

                  await args.loadPostsByTokenIds(tokenIds, chainIdStr);
                  likesLoadedByKeyRef.current[loadedKey] = true;
                  continue;
                } catch {
                  // If the subgraph is warming up or unavailable, fall back (current chain only).
                }
              }

              // Fallback: only for the currently connected chain (we don't reliably have other chains' contract addresses).
              if (String(args.chainId ?? "").trim() !== chainIdStr) continue;

              const resolvedChainIdNum = parseChainIdNumber(args.chainId);
              const rpcUrl = getRpcUrlForChainId(env, resolvedChainIdNum);

              let readContract: SocialPostsContract | null = null;
              let scanProvider: ChainProvider | null = null;

              if (rpcUrl && args.contractAddress) {
                const rpcProvider = getRpcProvider(rpcUrl, resolvedChainIdNum!);
                readContract = getSocialContract(args.contractAddress, rpcProvider);
                scanProvider = rpcProvider;
              } else {
                if (!args.walletProvider) continue;
                await args.ensureContractDeployedOnCurrentNetwork();
                readContract = await args.getReadContract();

                scanProvider = getScanProviderFromReadContract(readContract, args.walletProvider);
              }

              if (!readContract || !scanProvider) continue;

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

              const chainKey = parseChainKey(chainIdStr);
              const activeKeys = chainKey ? activeTokenIds.map((id) => `${chainKey}:${id}`) : activeTokenIds;

              setLikedTokenIdsByAddress((prev) => {
                const existingLikes = prev[key] ?? [];
                const preserved = chainKey
                  ? existingLikes.filter((k) => !k.startsWith(`${chainKey}:`))
                  : existingLikes;
                const merged = Array.from(new Set([...activeKeys, ...preserved]));
                return { ...prev, [key]: merged };
              });

              await args.loadPostsByTokenIds(activeTokenIds, chainIdStr);
              likesLoadedByKeyRef.current[loadedKey] = true;
            }
          } finally {
            setIsLoadingLikesByAddress((prev) => ({ ...prev, [key]: false }));
          }
        });
      } catch (err) {
        setStatusFromError(args.setStatus, err as ErrorInput);
      }
    },
    [
      args.walletProvider,
      args.chainId,
      args.selectedNetworkChainIds,
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
