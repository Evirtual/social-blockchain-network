import type { Post } from "@types";
import { mapWithConcurrency } from "@shared/lib/async";
import { fetchTokenMetadata } from "../../../metadata";
import { querySubgraph } from "@shared/lib/subgraphQuery";

function getErrMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function isLikelySchemaMismatch(err: unknown): boolean {
  const m = getErrMsg(err).toLowerCase();
  return (
    m.includes("cannot query field") ||
    m.includes("unknown type") ||
    m.includes("unknown argument") ||
    m.includes("unknown field") ||
    m.includes("unknown value") ||
    m.includes("expected type")
  );
}

type SubgraphPostRow = {
  tokenId: string;
  author?: string;
  tokenURI?: string;
  mintTxHash?: string;
  mintBlockNumber?: string;
  mintTimestamp?: string;
  likes?: string;
  comments?: string;
  saves?: string;
  tipsWei?: string;
  burnedAtBlock?: string | null;
};

function toInt(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toBigInt(v: unknown): bigint {
  try {
    return BigInt(String(v ?? "0"));
  } catch {
    return 0n;
  }
}

export async function loadFeedFromSubgraph(args: {
  url: string;
  chainIdStr: string | undefined;
  first?: number;
  account?: string | null;
}): Promise<Post[]> {
  const first = Math.max(1, Math.min(500, Number(args.first ?? 200)));

  // Expected schema (minimal):
  // posts(orderBy: mintBlockNumber, orderDirection: desc) {
  //   tokenId author tokenURI mintTxHash mintBlockNumber mintTimestamp likes comments saves tipsWei
  // }
  // Optional fields vary by subgraph deployment; treat them as best-effort.
  const queryWithBurned = `
    query FeedPosts($first: Int!) {
      posts(first: $first, orderBy: mintBlockNumber, orderDirection: desc) {
        tokenId
        author
        tokenURI
        mintTxHash
        mintBlockNumber
        mintTimestamp
        likes
        comments
        saves
        tipsWei
        burnedAtBlock
      }
    }
  `;

  const queryMinimal = `
    query FeedPosts($first: Int!) {
      posts(first: $first, orderBy: mintBlockNumber, orderDirection: desc) {
        tokenId
        author
        tokenURI
        mintTxHash
        mintBlockNumber
        mintTimestamp
        likes
        comments
        saves
        tipsWei
      }
    }
  `;

  let data: { posts: SubgraphPostRow[] };
  try {
    data = await querySubgraph<{ posts: SubgraphPostRow[] }>({
      url: args.url,
      query: queryWithBurned,
      variables: { first },
      timeoutMs: 12_000
    });
  } catch (err) {
    if (!isLikelySchemaMismatch(err)) throw err;
    data = await querySubgraph<{ posts: SubgraphPostRow[] }>({
      url: args.url,
      query: queryMinimal,
      variables: { first },
      timeoutMs: 12_000
    });
  }

  const rows = Array.isArray(data?.posts) ? data.posts : [];

  // Filter burned posts if the schema provides burnedAtBlock.
  const visible = rows.filter((p) => !(p?.burnedAtBlock && String(p.burnedAtBlock).length > 0));

  const accountLower = typeof args.account === "string" ? args.account.trim().toLowerCase() : "";
  const tokenIds = visible.map((p) => String(p.tokenId));

  let likedTokenIdSet: Set<string> | null = null;
  let savedTokenIdSet: Set<string> | null = null;

  if (accountLower) {
    try {
      const edgesQuery = `
        query FeedEdges($account: ID!, $tokenIds: [String!]!) {
          likeEdges(first: 1000, where: { account: $account, active: true, tokenId_in: $tokenIds }) {
            tokenId
          }
          saveEdges(first: 1000, where: { account: $account, active: true, tokenId_in: $tokenIds }) {
            tokenId
          }
        }
      `;

      const edgesQueryBigInt = `
        query FeedEdges($account: ID!, $tokenIds: [BigInt!]!) {
          likeEdges(first: 1000, where: { account: $account, active: true, tokenId_in: $tokenIds }) {
            tokenId
          }
          saveEdges(first: 1000, where: { account: $account, active: true, tokenId_in: $tokenIds }) {
            tokenId
          }
        }
      `;

      let edges:
        | {
            likeEdges: Array<{ tokenId: string }>;
            saveEdges: Array<{ tokenId: string }>;
          }
        | undefined;

      try {
        edges = await querySubgraph<{
          likeEdges: Array<{ tokenId: string }>;
          saveEdges: Array<{ tokenId: string }>;
        }>({
          url: args.url,
          query: edgesQuery,
          variables: { account: accountLower, tokenIds },
          timeoutMs: 8_000
        });
      } catch (err) {
        if (!isLikelySchemaMismatch(err)) throw err;
        edges = await querySubgraph<{
          likeEdges: Array<{ tokenId: string }>;
          saveEdges: Array<{ tokenId: string }>;
        }>({
          url: args.url,
          query: edgesQueryBigInt,
          variables: { account: accountLower, tokenIds },
          timeoutMs: 8_000
        });
      }

      const liked = Array.isArray(edges?.likeEdges) ? edges.likeEdges : [];
      const saved = Array.isArray(edges?.saveEdges) ? edges.saveEdges : [];

      likedTokenIdSet = new Set(liked.map((e) => String(e.tokenId)));
      savedTokenIdSet = new Set(saved.map((e) => String(e.tokenId)));
    } catch {
      // If edge queries fail (warming subgraph / schema mismatch), keep feed usable.
      likedTokenIdSet = null;
      savedTokenIdSet = null;
    }
  }

  const basePosts = visible.map((p) => {
    const tokenId = String(p.tokenId);
    const tokenURI = String(p.tokenURI ?? "");

    return {
      tokenId,
      chainId: args.chainIdStr,
      title: `Token #${tokenId}`,
      body: "",
      image: "",
      animationUrl: undefined,
      metadataURI: tokenURI,
      author: typeof p.author === "string" ? p.author : undefined,
      mintTxHash: typeof p.mintTxHash === "string" ? p.mintTxHash : undefined,
      mintBlockNumber: toInt(p.mintBlockNumber),
      mintTimestamp: toInt(p.mintTimestamp),
      likes: toInt(p.likes),
      comments: toInt(p.comments),
      saves: toInt(p.saves),
      tipsWei: toBigInt(p.tipsWei),
      likedByMe: likedTokenIdSet ? likedTokenIdSet.has(tokenId) : undefined,
      savedByMe: savedTokenIdSet ? savedTokenIdSet.has(tokenId) : undefined
    } satisfies Post;
  });

  // Enrich with off-chain metadata (or inline data:application/json;base64) just like the RPC loader.
  return await mapWithConcurrency(basePosts, 6, async (post) => {
    if (!post.metadataURI) return post;
    try {
      const meta = await fetchTokenMetadata(post.metadataURI);
      return {
        ...post,
        title: meta?.name ?? post.title,
        body: meta?.description ?? post.body,
        image: meta?.image ?? post.image,
        animationUrl: meta?.animation_url ?? post.animationUrl
      } satisfies Post;
    } catch {
      return post;
    }
  });
}
