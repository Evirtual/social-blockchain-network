import type { Post } from "@types";
import { resolveChainIdNum } from "./feedLoader/resolveChainIdNum";
import { fetchMintedEventsIncremental } from "./feedLoader/fetchMintedEventsIncremental";
import { pruneExistsFallback } from "./feedLoader/pruneExistsFallback";
import { loadRefreshTargets, type RefreshTarget } from "./feedLoader/loadRefreshTargets";
import type { ChainProvider, SocialPostsContract } from "@features/contract";

export type MintedEventLite = {
  author?: string;
  tokenIdBig: bigint;
  blockNumber?: number;
  txHash?: string;
};

export async function loadFeedFromProvider(args: {
  chainIdNum: number | null;
  networkProvider: ChainProvider;
  readContract: SocialPostsContract;
  maxLookbackBlocks: number;
  account: string | null;
  lastRefreshedAccount: string | null;
  postsSnapshot: Post[];
  postKey: (p: Pick<Post, "tokenId" | "chainId">) => string;
  pruneByKeys: (keys: Set<string>) => void;
}): Promise<Post[]> {
  const {
    chainIdNum,
    networkProvider,
    readContract,
    maxLookbackBlocks,
    account,
    lastRefreshedAccount,
    postsSnapshot,
    postKey,
    pruneByKeys
  } = args;

  const resolvedChainIdNum = await resolveChainIdNum({ chainIdNum, networkProvider });

  const chainCacheKey = String(resolvedChainIdNum ?? chainIdNum ?? "?");
  const chainLabel = String(resolvedChainIdNum ?? chainIdNum ?? "?");

  const accountChanged = (account ?? null) !== lastRefreshedAccount;

  const { mintedEvents, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds } =
    await fetchMintedEventsIncremental({
      chainLabel,
      chainCacheKey,
      maxLookbackBlocks,
      networkProvider,
      readContract
    });

  if (accountChanged && resolvedChainIdNum != null) {
    const chainIdStr = String(resolvedChainIdNum);
    for (const p of postsSnapshot) {
      if (p.chainId === chainIdStr) tokensNeedCountersRefresh.add(p.tokenId);
    }
  }

  if (burnedTokenIds.size > 0 && resolvedChainIdNum != null) {
    const chainIdStr = String(resolvedChainIdNum);
    const burnedKeys = new Set(Array.from(burnedTokenIds).map((id) => `${chainIdStr}:${id}`));
    pruneByKeys(burnedKeys);
  }

  const eventsNewestFirst = mintedEvents.slice().reverse();
  const existingByKey = new Map(postsSnapshot.map((p) => [postKey(p), p] as const));

  // Lightweight pruning fallback if burn logs were missed.
  await pruneExistsFallback({
    resolvedChainIdNum,
    postsSnapshot,
    postKey,
    pruneByKeys,
    readContract
  });

  const chainIdStr = resolvedChainIdNum != null ? String(resolvedChainIdNum) : undefined;
  const refreshTargets: RefreshTarget[] = [];
  for (const event of eventsNewestFirst) {
    const tokenId = event.tokenIdBig.toString();
    const key = chainIdStr ? `${chainIdStr}:${tokenId}` : undefined;
    const existing = key ? existingByKey.get(key) : undefined;

    const needsFull = tokensNeedFullRefresh.has(tokenId) || !existing;
    const needsCounters = tokensNeedCountersRefresh.has(tokenId);

    if (existing && !needsFull && !needsCounters) continue;
    if (burnedTokenIds.has(tokenId)) continue;

    refreshTargets.push({
      event,
      tokenId,
      tokenIdBig: event.tokenIdBig,
      chainIdStr,
      existing,
      needsFull,
      needsCounters
    });
  }

  const minted = await loadRefreshTargets({
    refreshTargets,
    readContract,
    resolvedChainIdNum,
    chainCacheKey,
    chainIdNum,
    networkProvider,
    account
  });

  return minted.filter((p): p is Post => p != null);
}
