import type { Post } from "@types";
import { mapWithConcurrency } from "@shared/lib/async";
import { fetchTokenMetadata } from "@features/metadata";
import { querySubgraph, tryQuerySubgraph, type SubgraphVariables } from "@shared/lib/subgraphQuery";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";
import { isLikelySubgraphSchemaMismatch } from "@shared/lib/subgraphSchemaMismatch";

type SubgraphPostRow = {
  tokenId: string;
  author?: string;
  tokenURI?: string;
  title?: string;
  body?: string;
  mintTxHash?: string;
  mintBlockNumber?: string;
  mintTimestamp?: string;
  likes?: string;
  comments?: string;
  saves?: string;
  tipsWei?: string;
  burnedAtBlock?: string | null;
};

const FEED_POSTS_CACHE_TTL_MS = 15 * 1000;
const FEED_EDGES_CACHE_TTL_MS = 15 * 1000;

const feedPostsInFlight: InFlightMap<SubgraphPostRow[]> = {};
const feedEdgesInFlight: InFlightMap<{ liked: string[]; saved: string[] }> = {};

function toInt(v: string | number | bigint | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toBigInt(v: string | number | bigint | null | undefined): bigint {
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
  searchQuery?: string | null;
  author?: string | null;
  authorIds?: string[] | null;
}): Promise<Post[]> {
  const first = Math.max(1, Math.min(500, Number(args.first ?? 200)));
  const bodyQuery = typeof args.searchQuery === "string" ? args.searchQuery.trim() : "";
  const authorFilter = typeof args.author === "string" ? args.author.trim() : "";
  const authorIds =
    Array.isArray(args.authorIds) && args.authorIds.length
      ? Array.from(new Set(args.authorIds.filter((id) => typeof id === "string" && id.trim()))).slice(0, 200)
      : [];

  // Expected schema (minimal):
  // posts(orderBy: mintBlockNumber, orderDirection: desc) {
  //   tokenId author tokenURI mintTxHash mintBlockNumber mintTimestamp likes comments saves tipsWei
  // }
  // Optional fields vary by subgraph deployment; treat them as best-effort.
  const queryWithBurnedBodyAndAuthor = `
    query FeedPosts($first: Int!, $query: String!, $author: Bytes!) {
      posts(
        first: $first,
        orderBy: mintBlockNumber,
        orderDirection: desc,
        where: { body_contains_nocase: $query, author: $author }
      ) {
        tokenId
        author
        tokenURI
        title
        body
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

  const queryWithBurnedBodyAndAuthorIn = `
    query FeedPosts($first: Int!, $query: String!, $authors: [Bytes!]!) {
      posts(
        first: $first,
        orderBy: mintBlockNumber,
        orderDirection: desc,
        where: { body_contains_nocase: $query, author_in: $authors }
      ) {
        tokenId
        author
        tokenURI
        title
        body
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

  const queryWithBurnedAndBody = `
    query FeedPosts($first: Int!, $query: String!) {
      posts(
        first: $first,
        orderBy: mintBlockNumber,
        orderDirection: desc,
        where: { body_contains_nocase: $query }
      ) {
        tokenId
        author
        tokenURI
        title
        body
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

  const queryWithBurnedAndAuthorIn = `
    query FeedPosts($first: Int!, $authors: [Bytes!]!) {
      posts(
        first: $first,
        orderBy: mintBlockNumber,
        orderDirection: desc,
        where: { author_in: $authors }
      ) {
        tokenId
        author
        tokenURI
        title
        body
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

  const queryWithBurnedAndAuthor = `
    query FeedPosts($first: Int!, $author: Bytes!) {
      posts(
        first: $first,
        orderBy: mintBlockNumber,
        orderDirection: desc,
        where: { author: $author }
      ) {
        tokenId
        author
        tokenURI
        title
        body
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

  const queryWithBurned = `
    query FeedPosts($first: Int!) {
      posts(first: $first, orderBy: mintBlockNumber, orderDirection: desc) {
        tokenId
        author
        tokenURI
        title
        body
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
        title
        body
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
  const query =
    authorFilter && bodyQuery
      ? queryWithBurnedBodyAndAuthor
      : authorFilter
        ? queryWithBurnedAndAuthor
        : authorIds.length && bodyQuery
          ? queryWithBurnedBodyAndAuthorIn
          : authorIds.length
            ? queryWithBurnedAndAuthorIn
            : bodyQuery
              ? queryWithBurnedAndBody
              : queryWithBurned;
  const variables = {
    first,
    ...(bodyQuery ? { query: bodyQuery } : {}),
    ...(authorFilter ? { author: authorFilter } : {}),
    ...(authorIds.length ? { authors: authorIds } : {})
  } satisfies SubgraphVariables;
  const postsCacheKey = `socialBlockchainNetwork.feed.posts.${args.url}.${first}.${bodyQuery}.${authorFilter}.${authorIds.join("|")}`;
  const cachedPosts = readSessionCache<{ posts?: SubgraphPostRow[]; ts?: number }>(postsCacheKey);
  if (Array.isArray(cachedPosts?.posts) && typeof cachedPosts?.ts === "number" && Date.now() - cachedPosts.ts < FEED_POSTS_CACHE_TTL_MS) {
    data = { posts: cachedPosts.posts };
  } else {
    const posts = await runInFlight(feedPostsInFlight, postsCacheKey, async () => {
      const primary = await tryQuerySubgraph<{ posts: SubgraphPostRow[] }>({
        url: args.url,
        query,
        variables,
        timeoutMs: 12_000
      });
      if (primary.ok) return primary.data.posts;

      if (!isLikelySubgraphSchemaMismatch(primary.error)) throw primary.error;
      try {
        const fallback = await querySubgraph<{ posts: SubgraphPostRow[] }>({
          url: args.url,
          query,
          variables,
          timeoutMs: 12_000
        });
        return fallback.posts;
      } catch (err) {
        if (!isLikelySubgraphSchemaMismatch(err)) throw err;
        const fallback = await querySubgraph<{ posts: SubgraphPostRow[] }>({
          url: args.url,
          query: queryMinimal,
          variables: { first },
          timeoutMs: 12_000
        });
        return fallback.posts;
      }
    });

    writeSessionCache(postsCacheKey, { posts, ts: Date.now() });
    data = { posts };
  }

  const rows = Array.isArray(data?.posts) ? data.posts : [];

  // Filter burned posts if the schema provides burnedAtBlock.
  const visible = rows.filter((p) => !(p?.burnedAtBlock && String(p.burnedAtBlock).length > 0));
  const authorLower = authorFilter.toLowerCase();
  const authorIdSet = new Set(authorIds.map((id) => id.toLowerCase()));
  const filtered = visible.filter((p) => {
    if (authorLower) {
      const postAuthor = String(p.author ?? "").toLowerCase();
      if (postAuthor !== authorLower) return false;
    }
    if (!authorLower && authorIdSet.size) {
      const postAuthor = String(p.author ?? "").toLowerCase();
      if (!authorIdSet.has(postAuthor)) return false;
    }
    if (bodyQuery) {
      return String(p.body ?? "").toLowerCase().includes(bodyQuery.toLowerCase());
    }
    return true;
  });

  const accountLower = typeof args.account === "string" ? args.account.trim().toLowerCase() : "";
  const tokenIds = filtered.map((p) => String(p.tokenId));

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

      const edgesCacheKey = `socialBlockchainNetwork.feed.edges.${args.url}.${accountLower}.${tokenIds.join(",")}`;
      const cachedEdges = readSessionCache<{ liked?: string[]; saved?: string[]; ts?: number }>(edgesCacheKey);

      const resolved =
        Array.isArray(cachedEdges?.liked) &&
        Array.isArray(cachedEdges?.saved) &&
        typeof cachedEdges?.ts === "number" &&
        Date.now() - cachedEdges.ts < FEED_EDGES_CACHE_TTL_MS
          ? { liked: cachedEdges.liked, saved: cachedEdges.saved }
          : await runInFlight(feedEdgesInFlight, edgesCacheKey, async () => {
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
                if (!isLikelySubgraphSchemaMismatch(err)) throw err;
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

              const liked = (Array.isArray(edges?.likeEdges) ? edges.likeEdges : [])
                .map((e) => String(e.tokenId))
                .filter(Boolean);
              const saved = (Array.isArray(edges?.saveEdges) ? edges.saveEdges : [])
                .map((e) => String(e.tokenId))
                .filter(Boolean);

              writeSessionCache(edgesCacheKey, { liked, saved, ts: Date.now() });
              return { liked, saved };
            });

      likedTokenIdSet = new Set((resolved?.liked ?? []).map((t) => String(t)));
      savedTokenIdSet = new Set((resolved?.saved ?? []).map((t) => String(t)));
    } catch {
      // If edge queries fail (warming subgraph / schema mismatch), keep feed usable.
      likedTokenIdSet = null;
      savedTokenIdSet = null;
    }
  }

  const basePosts = filtered.map((p) => {
    const tokenId = String(p.tokenId);
    const tokenURI = String(p.tokenURI ?? "");
    const title = typeof p.title === "string" ? p.title : `Token #${tokenId}`;
    const body = typeof p.body === "string" ? p.body : "";

    return {
      tokenId,
      chainId: args.chainIdStr,
      title,
      body,
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
