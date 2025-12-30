import { useEffect, useMemo, useRef } from "react";
import type { SupportedNetwork } from "../services/supportedNetworks";
import { useSessionStorageState } from "@shared/hooks/useSessionStorageState";

type Args = {
  searchQueryKey: string;
  selectedNetworksKey: string;
  walletAddress: string | null;
  chainId: string | null;
  supportedNetworks: SupportedNetwork[];
};

export function useNetworkFilterState({
  searchQueryKey,
  selectedNetworksKey,
  walletAddress,
  chainId,
  supportedNetworks
}: Args) {
  const [searchQuery, setSearchQuery] = useSessionStorageState<string>(searchQueryKey, "", {
    serialize: (v) => String(v ?? ""),
    parse: (raw) => String(raw ?? "")
  });

  const defaultSelectedNetworkChainIds = useMemo(
    () => supportedNetworks.map((n) => String(n.chainId)),
    [supportedNetworks]
  );

  const [selectedNetworkChainIds, setSelectedNetworkChainIds, hasStoredSelectedNetworks] = useSessionStorageState<
    string[]
  >(selectedNetworksKey, defaultSelectedNetworkChainIds, {
    serialize: (v) => JSON.stringify({ ids: v }),
    parse: (raw) => {
      try {
        const parsed = JSON.parse(raw) as any;
        const ids = Array.isArray(parsed?.ids)
          ? parsed.ids.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
          : [];
        return ids;
      } catch {
        return [];
      }
    }
  });

  const didInitDisconnectedNetworksRef = useRef(false);

  useEffect(() => {
    if (walletAddress) {
      didInitDisconnectedNetworksRef.current = false;
      return;
    }
    if (didInitDisconnectedNetworksRef.current) return;
    didInitDisconnectedNetworksRef.current = true;
    setSelectedNetworkChainIds(defaultSelectedNetworkChainIds);
  }, [walletAddress, defaultSelectedNetworkChainIds, setSelectedNetworkChainIds]);

  useEffect(() => {
    if (hasStoredSelectedNetworks) return;
    if (!walletAddress) return;
    const currentChainId = chainId ? String(chainId) : null;
    if (!currentChainId) return;
    const supported = new Set(supportedNetworks.map((n) => String(n.chainId)));
    if (!supported.has(currentChainId)) return;
    setSelectedNetworkChainIds([currentChainId]);
  }, [hasStoredSelectedNetworks, walletAddress, chainId, supportedNetworks, setSelectedNetworkChainIds]);

  const isNetworkFilterActive = useMemo(() => {
    const all = new Set(supportedNetworks.map((n) => String(n.chainId)));
    const selected = new Set(selectedNetworkChainIds.map(String));
    if (selected.size !== all.size) return true;
    for (const id of selected) {
      if (!all.has(id)) return true;
    }
    return false;
  }, [selectedNetworkChainIds, supportedNetworks]);

  return {
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    hasStoredSelectedNetworks,
    isNetworkFilterActive
  };
}
