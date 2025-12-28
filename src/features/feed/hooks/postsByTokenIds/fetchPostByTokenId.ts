import type { Post } from "@types";
import { fetchTokenMetadata } from "../../../metadata";

export async function fetchPostByTokenId(params: {
  id: string;
  currentChainId: number | null;
  readContract: any;
  walletAddress: string | null;
}): Promise<Post | null> {
  const { id, currentChainId, readContract, walletAddress } = params;

  const tokenIdBig = BigInt(id);
  let tokenUri = "";
  let likesRaw = 0n;
  let commentsRaw = 0n;
  let savesRaw = 0n;
  let tipsWei = 0n;
  let author = "";
  let likedByMe: boolean | undefined;
  let savedByMe: boolean | undefined;

  try {
    [tokenUri, likesRaw, commentsRaw, savesRaw, tipsWei, author, likedByMe, savedByMe] = await Promise.all([
      (readContract as any).tokenURI(tokenIdBig) as Promise<string>,
      (readContract as any).likesOf(tokenIdBig) as Promise<bigint>,
      (readContract as any).commentsOf(tokenIdBig) as Promise<bigint>,
      (readContract as any).savesOf(tokenIdBig) as Promise<bigint>,
      (readContract as any).tipsOf(tokenIdBig) as Promise<bigint>,
      (readContract as any).authorOf(tokenIdBig) as Promise<string>,
      walletAddress ? ((readContract as any).hasLiked(tokenIdBig, walletAddress) as Promise<boolean>) : Promise.resolve(undefined),
      walletAddress ? ((readContract as any).hasSaved(tokenIdBig, walletAddress) as Promise<boolean>) : Promise.resolve(undefined)
    ]);
  } catch {
    return null;
  }

  const meta = await fetchTokenMetadata(tokenUri);

  return {
    tokenId: id,
    chainId: currentChainId != null ? String(currentChainId) : undefined,
    title: meta?.name ?? `Token #${id}`,
    body: meta?.description ?? "",
    image: meta?.image ?? "",
    animationUrl: meta?.animation_url,
    metadataURI: tokenUri,
    author,
    likes: Number(likesRaw),
    comments: Number(commentsRaw),
    saves: Number(savesRaw),
    tipsWei,
    likedByMe,
    savedByMe
  } satisfies Post;
}
