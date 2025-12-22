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
