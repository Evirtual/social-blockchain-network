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

type Args = {
  walletProvider: BrowserProvider | null;
  chainId: string | null;

  contractAddress: string | undefined;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;

  loadPostsByTokenIds: (tokenIds: string[]) => Promise<void>;
  setStatus: (status: string) => void;
};

export function useSavedPostsByAddress(args: Args) {
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

        // Avoid re-scanning once we have successfully loaded saved posts for this address on this network.
        const networkKey = String(args.chainId ?? args.contractAddress ?? "").toLowerCase();
        const loadedKey = `${networkKey}:${key}`;
        if (loadedKey && savedLoadedByKeyRef.current[loadedKey]) return;

        await runInFlight(savedInFlightRef.current, key, async () => {
          setIsLoadingSavedByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const env = getEnv();
            const resolvedChainIdNum = parseChainIdNumber(args.chainId);

            const subgraphUrl = getSubgraphUrlForChainId(env, resolvedChainIdNum);
            if (subgraphUrl) {
              try {
                const query = `
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

                const data = await querySubgraph<{ saveEdges: Array<{ tokenId: string }> }>({
                  url: subgraphUrl,
                  query,
                  variables: { account: key, first: 1000 },
                  timeoutMs: 10_000
                });

                const tokenIds = (Array.isArray(data?.saveEdges) ? data.saveEdges : [])
                  .map((e) => String(e?.tokenId ?? "").trim())
                  .filter(Boolean);

                const chainKey = parseChainKey(args.chainId);
                const activeKeys = chainKey ? tokenIds.map((id) => `${chainKey}:${id}`) : tokenIds;

                setSavedTokenIdsByAddress((prev) => {
                  const existing = prev[key] ?? [];
                  const preserved = chainKey ? existing.filter((k) => !k.startsWith(`${chainKey}:`)) : existing;
                  const merged = Array.from(new Set([...activeKeys, ...preserved]));
                  return { ...prev, [key]: merged };
                });

                await args.loadPostsByTokenIds(tokenIds);

                savedLoadedByKeyRef.current[loadedKey] = true;
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
              onFilter: readContract.filters.PostSaved(address, null),
              offFilter: readContract.filters.PostUnsaved(address, null),
              onEventName: "PostSaved",
              offEventName: "PostUnsaved",
              tokenIdArgIndex: 1
            });

            const chainKey = parseChainKey(args.chainId);
            const activeKeys = chainKey ? activeTokenIds.map((id) => `${chainKey}:${id}`) : activeTokenIds;

            setSavedTokenIdsByAddress((prev) => {
              const existing = prev[key] ?? [];
              const preserved = chainKey ? existing.filter((k) => !k.startsWith(`${chainKey}:`)) : existing;
              const merged = Array.from(new Set([...activeKeys, ...preserved]));
              return { ...prev, [key]: merged };
            });

            await args.loadPostsByTokenIds(activeTokenIds);

            savedLoadedByKeyRef.current[loadedKey] = true;
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
