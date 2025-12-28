import type { Post } from "@types";

export function computeCommentsFromBlock(params: {
  latestBlock: number;
  cachedLastScannedBlock: number | null;
  mintHintBlockNumber: number | undefined;
}): number {
  const { latestBlock, cachedLastScannedBlock, mintHintBlockNumber } = params;

  const defaultFromBlock = (() => {
    if (typeof mintHintBlockNumber === "number" && Number.isFinite(mintHintBlockNumber) && mintHintBlockNumber >= 0) {
      return Math.floor(mintHintBlockNumber);
    }
    return Math.max(0, latestBlock - 25_000);
  })();

  const fromBlock = cachedLastScannedBlock != null ? Math.max(0, cachedLastScannedBlock + 1) : defaultFromBlock;
  return fromBlock;
}

export function findMintBlockHint(posts: Post[], tokenId: string, postChainId?: string | null) {
  return posts.find((p) => {
    if (p.tokenId !== tokenId) return false;
    if (postChainId && p.chainId && p.chainId !== postChainId) return false;
    if (postChainId && !p.chainId) return false;
    return true;
  })?.mintBlockNumber;
}
