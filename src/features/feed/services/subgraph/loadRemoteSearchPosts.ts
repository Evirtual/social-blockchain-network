import type { Post } from "@types";
import { getEnv } from "@shared/lib/env";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import { isLikelySubgraphSchemaMismatch } from "@shared/lib/subgraphSchemaMismatch";
import { loadFeedFromSubgraph } from "./loadFeedFromSubgraph";

const authorIdsInFlight: InFlightMap<string[]> = {};

const AUTHOR_IDS_TTL_MS = 5 * 60 * 1000;

function isProbablyAddressQuery(q: string): boolean {
  const s = String(q ?? "").trim().toLowerCase();
  // Basic 0x + 40 hex chars. (If user pastes short fragments, treat as non-address.)
  return /^0x[a-f0-9]{40}$/.test(s);
}

async function loadAuthorIdsForQuery(args: { subgraphUrl: string; query: string }): Promise<string[]> {
  const queryLower = args.query.trim().toLowerCase();
  const cacheKey = `socialBlockchainNetwork.search.authors.${args.subgraphUrl}.${queryLower}`;

  return await runInFlight(authorIdsInFlight, cacheKey, async () => {
    // If the user searched for an exact address, we already know the author id.
    // Skip any subgraph lookups entirely.
    if (isProbablyAddressQuery(queryLower)) {
      const ids = [queryLower];
      writeSessionCache(cacheKey, { ids, ts: Date.now() });
      return ids;
    }

    const cached = readSessionCache<{ ids?: string[]; ts?: number }>(cacheKey);
    if (
      Array.isArray(cached?.ids) &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < AUTHOR_IDS_TTL_MS
    ) {
      return cached.ids.filter((x) => typeof x === "string" && x.trim());
    }

    const authorIds: string[] = [];

    const byNameQuery = `query AccountByName($query: String!, $first: Int!) {
  accounts(first: $first, where: { name_contains_nocase: $query }) {
    id
  }
}`;

    // Schema-safe bundle:
    // - name search via accounts(where: { name_contains_nocase })
    // - exact id lookup via account(id: ...) (no *_contains_* filters)
    // Passing a dummy ID for non-address searches returns null without error.
    const bundleQuery = `query SearchAuthorsBundle($query: String!, $first: Int!, $id: ID!) {
  byName: accounts(first: $first, where: { name_contains_nocase: $query }) { id }
  byId: account(id: $id) { id }
}`;

    try {
      const bundled = await tryQuerySubgraph<{
        byName?: Array<{ id: string }>;
        byId?: { id: string } | null;
      }>({
        url: args.subgraphUrl,
        query: bundleQuery,
        variables: {
          query: args.query,
          first: 50,
          id: "0x0000000000000000000000000000000000000000"
        },
        timeoutMs: 8_000
      });

      if (bundled.ok) {
        authorIds.push(...(bundled.data?.byName ?? []).map((a) => a.id));
        if (bundled.data?.byId?.id) authorIds.push(bundled.data.byId.id);
      } else if (isLikelySubgraphSchemaMismatch(bundled.error)) {
        // Fall back to the minimal by-name query if this subgraph doesn't
        // support the bundle fields/filters.
        const byName = await tryQuerySubgraph<{ accounts: Array<{ id: string }> }>({
          url: args.subgraphUrl,
          query: byNameQuery,
          variables: { query: args.query, first: 50 },
          timeoutMs: 8_000
        });

        if (byName.ok) {
          authorIds.push(...(byName.data?.accounts ?? []).map((a) => a.id));
        }
      }
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
