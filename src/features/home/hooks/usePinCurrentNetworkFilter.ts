import { useEffect } from "react";

export function usePinCurrentNetworkFilter(params: {
  walletAddress: string | null;
  chainId: string | null;
  supportedNetworks: Array<{ chainId: number }>;
  setSelectedNetworkChainIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { walletAddress, chainId, supportedNetworks, setSelectedNetworkChainIds } = params;

  useEffect(() => {
    // UX requirement: when a wallet is connected and on a supported chain,
    // keep the Networks filter pinned to the current chain.
    if (!walletAddress) {
      setSelectedNetworkChainIds([]);
      return;
    }

    const currentChainId = chainId ? String(chainId) : null;
    if (!currentChainId) return;

    const supported = new Set(supportedNetworks.map((n) => String(n.chainId)));
    if (!supported.has(currentChainId)) return;

    setSelectedNetworkChainIds((prev) => (prev.length === 1 && prev[0] === currentChainId ? prev : [currentChainId]));
  }, [walletAddress, chainId, supportedNetworks, setSelectedNetworkChainIds]);
}
