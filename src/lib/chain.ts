export function getExplorerTxUrl(chainId: string | null, txHash: string) {
  if (!chainId) return null;
  const id = Number(chainId);
  const base =
    id === 1
      ? "https://etherscan.io"
      : id === 11155111
        ? "https://sepolia.etherscan.io"
        : id === 8453
          ? "https://basescan.org"
          : id === 84532
            ? "https://sepolia.basescan.org"
            : null;
  if (!base) return null;
  return `${base}/tx/${txHash}`;
}

export function getNativeSymbol(chainId: string | null) {
  const id = Number(chainId);
  if (id === 56 || id === 97) return "BNB";
  return "ETH";
}

export function getNetworkBadgeLabel(chainId: string | null) {
  const id = Number(chainId);
  if (id === 1) return "ETH";
  if (id === 11155111) return "SEP";
  if (id === 8453) return "BASE";
  if (id === 84532) return "BASE-SEP";
  if (id === 56) return "BSC";
  if (id === 97) return "BSC-T";
  return chainId ? `#${id}` : "";
}
