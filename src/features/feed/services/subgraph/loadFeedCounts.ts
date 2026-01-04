import { getEnv } from "@shared/lib/env";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";

const inFlight: InFlightMap<number> = {};

const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeSelectedChainIds(selectedChainIds: string[]): string[] {
  return (selectedChainIds ?? [])
    .filter((x) => typeof x === "string" && x.trim())
    .map((x) => x.trim())
    .slice()
    .sort();
}

export async function loadTotalPostsCountFromSubgraphs(args: {
  selectedChainIds: string[];
}): Promise<number> {
  const selectedIds = normalizeSelectedChainIds(args.selectedChainIds);
  const cacheKey = `socialBlockchainNetwork.feed.totalPosts.${selectedIds.join(",")}`;

  return await runInFlight(inFlight, cacheKey, async () => {
    const cached = readSessionCache<{ count?: number; ts?: number }>(cacheKey);
    if (
      typeof cached?.count === "number" &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < CACHE_TTL_MS
    ) {
      return cached.count;
    }

    const env = getEnv();
    let sum = 0;
    for (const id of selectedIds) {
      const chainIdNum = Number(id);
      if (!Number.isFinite(chainIdNum)) continue;
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (!subgraphUrl) continue;

      const result = await tryQuerySubgraph<{
        globalStats: { totalPosts?: string | null } | null;
      }>({
        url: subgraphUrl,
        query: `query GlobalStats { globalStats(id: "global") { totalPosts } }`,
        variables: {},
        timeoutMs: 8_000
      });

      if (!result.ok) continue;
      const total = Number(result.data?.globalStats?.totalPosts ?? 0);
      if (Number.isFinite(total)) sum += total;
    }

    writeSessionCache(cacheKey, { count: sum, ts: Date.now() });
    return sum;
  });
}

export async function loadAuthorPostsCountFromSubgraphs(args: {
  authorAddress: string;
  selectedChainIds: string[];
}): Promise<number> {
  const author = String(args.authorAddress ?? "")
    .trim()
    .toLowerCase();
  const selectedIds = normalizeSelectedChainIds(args.selectedChainIds);
  const cacheKey = `socialBlockchainNetwork.profile.posts.${author}.${selectedIds.join(",")}`;

  return await runInFlight(inFlight, cacheKey, async () => {
    const cached = readSessionCache<{ count?: number; ts?: number }>(cacheKey);
    if (
      typeof cached?.count === "number" &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < CACHE_TTL_MS
    ) {
      return cached.count;
    }

    const env = getEnv();
    let sum = 0;
    for (const id of selectedIds) {
      const chainIdNum = Number(id);
      if (!Number.isFinite(chainIdNum)) continue;
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (!subgraphUrl) continue;

      const result = await tryQuerySubgraph<{
        account: { postedCount?: string | null } | null;
      }>({
        url: subgraphUrl,
        query: `query AccountPosts($id: ID!) { account(id: $id) { postedCount } }`,
        variables: { id: author },
        timeoutMs: 8_000
      });

      if (!result.ok) continue;
      const count = Number(result.data?.account?.postedCount ?? 0);
      if (Number.isFinite(count)) sum += count;
    }

    writeSessionCache(cacheKey, { count: sum, ts: Date.now() });
    return sum;
  });
}
