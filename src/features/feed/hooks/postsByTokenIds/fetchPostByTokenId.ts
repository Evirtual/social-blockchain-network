import type { Post } from "@types";
import { fetchTokenMetadata } from "@features/metadata";
import type { SocialPostsContract } from "@features/contract/types";

export async function fetchPostByTokenId(params: {
  id: string;
  currentChainId: number | null;
  readContract: SocialPostsContract;
  walletAddress: string | null;
}): Promise<Post | null> {
  const { id, currentChainId, readContract, walletAddress } = params;

  let tokenIdBig: bigint;
  try {
    tokenIdBig = BigInt(id);
  } catch {
    return null;
  }
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
      readContract.tokenURI(tokenIdBig) as Promise<string>,
      readContract.likesOf(tokenIdBig) as Promise<bigint>,
      readContract.commentsOf(tokenIdBig) as Promise<bigint>,
      readContract.savesOf(tokenIdBig) as Promise<bigint>,
      readContract.tipsOf(tokenIdBig) as Promise<bigint>,
      readContract.authorOf(tokenIdBig) as Promise<string>,
      walletAddress ? (readContract.hasLiked(tokenIdBig, walletAddress) as Promise<boolean>) : Promise.resolve(undefined),
      walletAddress ? (readContract.hasSaved(tokenIdBig, walletAddress) as Promise<boolean>) : Promise.resolve(undefined)
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
