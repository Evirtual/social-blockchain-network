import { useCallback, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";
import { getSocialContract, socialInterface } from "../../contract";
import { getErrorMessage } from "@shared/lib/errors";
import { getRpcProvider, getRpcUrlForChainId, parseChainIdNumber } from "@shared/lib/rpc";
import { parseChainKey } from "@shared/lib/chainKey";
import { readSessionTokenIds, writeSessionTokenIds } from "@shared/lib/sessionTokenCache";
import { scanToggleEventsForAddress } from "../services/toggleEventScanner";
import { runInFlight } from "@shared/lib/inFlight";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";

type Args = {
  walletProvider: BrowserProvider | null;
  chainId: string | null;

  contractAddress: string | undefined;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;

  loadPostsByTokenIds: (tokenIds: string[]) => Promise<void>;
  setStatus: (status: string) => void;
};

const SAVED_SESSION_CACHE_PREFIX = "savedTokenKeysByAddress:";

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
      writeSessionTokenIds(SAVED_SESSION_CACHE_PREFIX, key, next);
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

        const cached = readSessionTokenIds(SAVED_SESSION_CACHE_PREFIX, key);
        if (cached !== null) {
          setSavedTokenIdsByAddress((prev) => ({ ...prev, [key]: cached }));
          savedLoadedByKeyRef.current[loadedKey] = true;
          return;
        }

        await runInFlight(savedInFlightRef.current, key, async () => {
          setIsLoadingSavedByAddress((prev) => ({ ...prev, [key]: true }));
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
              onFilter: (readContract as any).filters.PostSaved(address, null),
              offFilter: (readContract as any).filters.PostUnsaved(address, null),
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
              writeSessionTokenIds(SAVED_SESSION_CACHE_PREFIX, key, merged);
              return { ...prev, [key]: merged };
            });

            await args.loadPostsByTokenIds(activeTokenIds);

            savedLoadedByKeyRef.current[loadedKey] = true;
          } finally {
            setIsLoadingSavedByAddress((prev) => ({ ...prev, [key]: false }));
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
    savedTokenIdsByAddress,
    isLoadingSavedByAddress,
    loadSavedForAddress,
    toggleSavedKey
  };
}
