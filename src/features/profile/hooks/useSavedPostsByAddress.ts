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
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";
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

export function useSavedPostsByAddress(args: Args) {
  const cacheTtlMs = 60 * 1000;
  const [savedTokenIdsByAddress, setSavedTokenIdsByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingSavedByAddress, setIsLoadingSavedByAddress] = useState<Record<string, boolean>>({});

  const savedInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const savedLoadedByKeyRef = useRef<Record<string, boolean>>({});

  const toggleSavedKey = useCallback((addressLower: string, chainId: string | null, tokenId: string) => {
    const key = addressLower.trim().toLowerCase();
    if (!key) return;

    const chainKey = parseChainKey(chainId);
    const savedKey = chainKey ? `${chainKey}:${tokenId}` : tokenId;

    setSavedTokenIdsByAddress((prev) => {
      const current = prev[key] ?? [];
      const has = current.includes(savedKey);
      const next = has ? current.filter((id) => id !== savedKey) : [savedKey, ...current];
      return { ...prev, [key]: next };
    });
  }, []);

  const loadSavedForAddress = useCallback(
    async (address: string) => {
      try {
        if (!address) return;

        const key = address.toLowerCase();

        const selectedIds = Array.isArray(args.selectedNetworkChainIds) ? args.selectedNetworkChainIds : [];
        if (selectedIds.length === 0) return;

        await runInFlight(savedInFlightRef.current, key, async () => {
          setIsLoadingSavedByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const env = getEnv();
            const saveEdgesQuery = `
              query AccountSaves($account: ID!, $first: Int!) {
                saveEdges(
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
              if (savedLoadedByKeyRef.current[loadedKey]) continue;

              const sessionKey = `socialBlockchainNetwork.profile.saves.${loadedKey}`;
              const cached = readSessionCache<{ tokenIds?: string[]; ts?: number }>(sessionKey);
              if (Array.isArray(cached?.tokenIds) && typeof cached?.ts === "number" && Date.now() - cached.ts < cacheTtlMs) {
                const tokenIds = cached.tokenIds.map((t) => String(t ?? "").trim()).filter(Boolean);

                const chainKey = parseChainKey(chainIdStr);
                const activeKeys = chainKey ? tokenIds.map((id) => `${chainKey}:${id}`) : tokenIds;

                setSavedTokenIdsByAddress((prev) => {
                  const existing = prev[key] ?? [];
                  const preserved = chainKey ? existing.filter((k) => !k.startsWith(`${chainKey}:`)) : existing;
                  const merged = Array.from(new Set([...activeKeys, ...preserved]));
                  return { ...prev, [key]: merged };
                });

                await args.loadPostsByTokenIds(tokenIds, chainIdStr);
                savedLoadedByKeyRef.current[loadedKey] = true;
                continue;
              }

              const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
              if (subgraphUrl) {
                try {
                  const data = await querySubgraph<{ saveEdges: Array<{ tokenId: string }> }>({
                    url: subgraphUrl,
                    query: saveEdgesQuery,
                    variables: { account: key, first: 1000 },
                    timeoutMs: 10_000
                  });

                  const tokenIds = (Array.isArray(data?.saveEdges) ? data.saveEdges : [])
                    .map((e) => String(e?.tokenId ?? "").trim())
                    .filter(Boolean);

                  const chainKey = parseChainKey(chainIdStr);
                  const activeKeys = chainKey ? tokenIds.map((id) => `${chainKey}:${id}`) : tokenIds;

                  setSavedTokenIdsByAddress((prev) => {
                    const existing = prev[key] ?? [];
                    const preserved = chainKey ? existing.filter((k) => !k.startsWith(`${chainKey}:`)) : existing;
                    const merged = Array.from(new Set([...activeKeys, ...preserved]));
                    return { ...prev, [key]: merged };
                  });

                  await args.loadPostsByTokenIds(tokenIds, chainIdStr);
                  writeSessionCache(sessionKey, { tokenIds, ts: Date.now() });
                  savedLoadedByKeyRef.current[loadedKey] = true;
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
                onFilter: readContract.filters.PostSaved(address, null),
                offFilter: readContract.filters.PostUnsaved(address, null),
                onEventName: "PostSaved",
                offEventName: "PostUnsaved",
                tokenIdArgIndex: 1
              });

              const chainKey = parseChainKey(chainIdStr);
              const activeKeys = chainKey ? activeTokenIds.map((id) => `${chainKey}:${id}`) : activeTokenIds;

              setSavedTokenIdsByAddress((prev) => {
                const existing = prev[key] ?? [];
                const preserved = chainKey ? existing.filter((k) => !k.startsWith(`${chainKey}:`)) : existing;
                const merged = Array.from(new Set([...activeKeys, ...preserved]));
                return { ...prev, [key]: merged };
              });

              await args.loadPostsByTokenIds(activeTokenIds, chainIdStr);
              writeSessionCache(sessionKey, { tokenIds: activeTokenIds, ts: Date.now() });
              savedLoadedByKeyRef.current[loadedKey] = true;
            }
          } finally {
            setIsLoadingSavedByAddress((prev) => ({ ...prev, [key]: false }));
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
    savedTokenIdsByAddress,
    isLoadingSavedByAddress,
    loadSavedForAddress,
    toggleSavedKey
  };
}
