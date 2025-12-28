import type { Post } from "@types";
import { mapWithConcurrency } from "@shared/lib/async";
import { fetchTokenMetadata } from "../../../metadata";
import type { MintedEventLite, BlockTimestampCache } from "../feedLoader";
import { getMintTimestampIfNeeded } from "./getMintTimestampIfNeeded";

export type RefreshTarget = {
  event: MintedEventLite;
  tokenId: string;
  tokenIdBig: bigint;
  chainIdStr: string | undefined;
  existing?: Post;
  needsFull: boolean;
  needsCounters: boolean;
};

export async function loadRefreshTargets(args: {
  refreshTargets: RefreshTarget[];
  readContract: any;
  resolvedChainIdNum: number | null;
  chainCacheKey: string;
  chainIdNum: number | null;
  networkProvider: any;
  blockTimestampCache: BlockTimestampCache;
  account: string | null;
}) {
  return await mapWithConcurrency<RefreshTarget, Post | null>(args.refreshTargets, 6, async (t) => {
    const author = t.event.author;
    const tokenIdBig = t.tokenIdBig;
    const tokenId = t.tokenId;
    const existing = t.existing;

    const blockNumber = Number(t.event.blockNumber ?? 0) || undefined;
    const txHash = (t.event.txHash as string | undefined) ?? undefined;

    const mintTimestamp = await getMintTimestampIfNeeded({
      needsFull: t.needsFull,
      existing,
      eventBlockNumber: t.event.blockNumber,
      networkProvider: args.networkProvider,
      chainCacheKey: args.chainCacheKey,
      blockTimestampCache: args.blockTimestampCache
    });

    let likesRaw = 0n;
    let commentsRaw = 0n;
    let savesRaw = 0n;
    let tipsWei = 0n;
    let likedByMe: boolean | undefined;
    let savedByMe: boolean | undefined;
    try {
      [likesRaw, commentsRaw, savesRaw, tipsWei, likedByMe, savedByMe] = await Promise.all([
        args.readContract.likesOf(tokenIdBig) as Promise<bigint>,
        args.readContract.commentsOf(tokenIdBig) as Promise<bigint>,
        args.readContract.savesOf(tokenIdBig) as Promise<bigint>,
        args.readContract.tipsOf(tokenIdBig) as Promise<bigint>,
        args.account
          ? ((args.readContract as any).hasLiked(tokenIdBig, args.account) as Promise<boolean>)
          : Promise.resolve(undefined),
        args.account
          ? ((args.readContract as any).hasSaved(tokenIdBig, args.account) as Promise<boolean>)
          : Promise.resolve(undefined)
      ]);
    } catch {
      return null;
    }

    if (existing && !t.needsFull) {
      return {
        ...existing,
        likes: Number(likesRaw),
        comments: Number(commentsRaw),
        saves: Number(savesRaw),
        tipsWei,
        likedByMe,
        savedByMe
      } satisfies Post;
    }

    let tokenUri = "";
    try {
      tokenUri = (await args.readContract.tokenURI(tokenIdBig)) as string;
    } catch {
      return null;
    }

    const meta = await fetchTokenMetadata(tokenUri);

    return {
      tokenId,
      chainId: args.resolvedChainIdNum != null ? String(args.resolvedChainIdNum) : undefined,
      title: meta?.name ?? `Token #${tokenId}`,
      body: meta?.description ?? "",
      image: meta?.image ?? "",
      animationUrl: meta?.animation_url,
      metadataURI: tokenUri,
      author: existing?.author ?? author,
      mintTxHash: existing?.mintTxHash ?? txHash,
      mintBlockNumber: existing?.mintBlockNumber ?? blockNumber,
      mintTimestamp: existing?.mintTimestamp ?? mintTimestamp,
      likes: Number(likesRaw),
      comments: Number(commentsRaw),
      saves: Number(savesRaw),
      tipsWei,
      likedByMe,
      savedByMe
    } satisfies Post;
  });
}
