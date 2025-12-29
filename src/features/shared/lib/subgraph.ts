export function getSubgraphUrlForChainId(env: any, chainIdNum: number | null): string {
  if (chainIdNum == null) return "";

  const urlByChainId: Record<number, string | undefined> = {
    1: env?.VITE_ETH_SUBGRAPH_URL,
    11155111: env?.VITE_ETH_SEPOLIA_SUBGRAPH_URL,
    8453: env?.VITE_BASE_SUBGRAPH_URL,
    84532: env?.VITE_BASE_SEPOLIA_SUBGRAPH_URL,
    56: env?.VITE_BSC_SUBGRAPH_URL,
    97: env?.VITE_BSC_TESTNET_SUBGRAPH_URL
  };

  const v = urlByChainId[chainIdNum];
  return typeof v === "string" ? v.trim() : "";
}
