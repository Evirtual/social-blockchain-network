import type { Post } from "@types";
import { getEnv } from "@shared/lib/env";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import { loadFeedFromSubgraph } from "./loadFeedFromSubgraph";

const authorIdsInFlight: InFlightMap<string[]> = {};

const AUTHOR_IDS_TTL_MS = 5 * 60 * 1000;

async function loadAuthorIdsForQuery(args: { subgraphUrl: string; query: string }): Promise<string[]> {
  const queryLower = args.query.trim().toLowerCase();
  const cacheKey = `socialBlockchainNetwork.search.authors.${args.subgraphUrl}.${queryLower}`;

  return await runInFlight(authorIdsInFlight, cacheKey, async () => {
    const cached = readSessionCache<{ ids?: string[]; ts?: number }>(cacheKey);
    if (
      Array.isArray(cached?.ids) &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < AUTHOR_IDS_TTL_MS
    ) {
      return cached.ids.filter((x) => typeof x === "string" && x.trim());
    }

    const authorIds: string[] = [];

    try {
      const byName = await tryQuerySubgraph<{ accounts: Array<{ id: string }> }>({
        url: args.subgraphUrl,
        query: `query AccountByName($query: String!, $first: Int!) { accounts(first: $first, where: { name_contains_nocase: $query }) { id } }`,
        variables: { query: args.query, first: 50 },
        timeoutMs: 8_000
      });
      if (byName.ok) authorIds.push(...(byName.data?.accounts ?? []).map((a) => a.id));
    } catch {
      // ignore schema mismatch
    }

    try {
      const byId = await tryQuerySubgraph<{ accounts: Array<{ id: string }> }>({
        url: args.subgraphUrl,
        query: `query AccountById($query: String!, $first: Int!) { accounts(first: $first, where: { id_contains_nocase: $query }) { id } }`,
        variables: { query: args.query, first: 50 },
        timeoutMs: 8_000
      });
      if (byId.ok) authorIds.push(...(byId.data?.accounts ?? []).map((a) => a.id));
    } catch {
      // ignore schema mismatch
    }

    const unique = Array.from(new Set(authorIds)).filter((x) => typeof x === "string" && x.trim());
    writeSessionCache(cacheKey, { ids: unique, ts: Date.now() });
    return unique;
  });
}

export async function loadRemoteSearchPostsFromSubgraphs(args: {
  selectedChainIds: string[];
  searchQuery: string;
  walletAddress: string | null;
  authorFilter: string;
}): Promise<Post[] | null> {
  const trimmedQuery = String(args.searchQuery ?? "").trim();
  const env = getEnv();

  const collected: Post[] = [];
  let hadSuccess = false;
  let hadFailure = false;

  const selectedIds = (args.selectedChainIds ?? [])
    .filter((x) => typeof x === "string" && x.trim())
    .map((x) => x.trim());

  for (const id of selectedIds) {
    const chainIdNum = Number(id);
    if (!Number.isFinite(chainIdNum)) continue;

    const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
    if (!subgraphUrl) continue;

    let authorIds: string[] = [];
    try {
      authorIds = await loadAuthorIdsForQuery({ subgraphUrl, query: trimmedQuery });
    } catch {
      // ignore
    }

    try {
      const uniqueAuthorIds = Array.from(new Set(authorIds));
      const found = await loadFeedFromSubgraph({
        url: subgraphUrl,
        chainIdStr: String(chainIdNum),
        first: 200,
        account: args.walletAddress ? args.walletAddress.toLowerCase() : null,
        searchQuery: trimmedQuery,
        author: args.authorFilter || null,
        authorIds: uniqueAuthorIds.length ? uniqueAuthorIds : null
      });

      hadSuccess = true;
      collected.push(...found);
    } catch {
      hadFailure = true;
    }
  }

  if (!hadSuccess) return null;
  if (!collected.length && hadFailure) return null;
  return collected.length ? collected : [];
}
