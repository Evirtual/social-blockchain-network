import type { NotificationItem } from "../types";
import { querySubgraph, type SubgraphVariables } from "@shared/lib/subgraphQuery";
import { isLikelySubgraphSchemaMismatch } from "@shared/lib/subgraphSchemaMismatch";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readLocalCache, writeLocalCache } from "@shared/lib/localCache";
import { isPostBurned } from "@shared/lib/burnedPostsCache";
import { isCommentDeleted } from "@shared/lib/deletedCommentsCache";

const inFlight: InFlightMap<{ items: NotificationItem[]; schemaMismatch: boolean }> = {};
const CACHE_TTL_MS = 20 * 1000;
const BURNED_CHECK_LIMIT = 200;

function toInt(v: string | number | bigint | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function filterDeleted(items: NotificationItem[], chainIdStr: string): NotificationItem[] {
  if (!chainIdStr) return items;
  return items.filter((n) => {
    const keepPostRemoval = n.kind === "POST_REMOVED_BY_ADMIN";
    const keepCommentRemoval = n.kind === "COMMENT_REMOVED";
    if (!keepPostRemoval && isPostBurned(chainIdStr, n.tokenId)) return false;
    if (!keepCommentRemoval && n.commentId && isCommentDeleted(chainIdStr, n.tokenId, n.commentId)) return false;
    return true;
  });
}

async function fetchBurnedTokenIds(url: string, tokenIds: string[]): Promise<Set<string> | null> {
  const keys = Array.from(new Set(tokenIds.map((t) => String(t ?? "").trim()).filter(Boolean))).slice(0, BURNED_CHECK_LIMIT);
  if (keys.length === 0) return new Set();

  try {
    const data = await querySubgraph<{
      posts: Array<{ tokenId?: string; burnedAtBlock?: string | null }>;
    }>({
      url,
      query: `
        query BurnedPosts($tokenIds: [String!]!) {
          posts(where: { tokenId_in: $tokenIds }) {
            tokenId
            burnedAtBlock
          }
        }
      `,
      variables: { tokenIds: keys } satisfies SubgraphVariables,
      timeoutMs: 8_000
    });

    const burned = new Set<string>();
    for (const row of Array.isArray(data?.posts) ? data.posts : []) {
      const tokenId = String(row?.tokenId ?? "").trim();
      if (!tokenId) continue;
      if (row?.burnedAtBlock && String(row.burnedAtBlock).length > 0) burned.add(tokenId);
    }
    return burned;
  } catch {
    return null;
  }
}

type SubgraphNotificationRow = {
  id?: string;
  kind?: string;
  tokenId?: string;
  commentId?: string | null;
  timestamp?: string;
  actor?: {
    id?: string;
    name?: string | null;
    avatar?: string | null;
  } | null;
};

export async function loadNotificationsFromSubgraph(args: {
  url: string;
  recipient: string;
  first?: number;
  bypassCache?: boolean;
  chainIdStr?: string | null;
}): Promise<{ items: NotificationItem[]; schemaMismatch: boolean }> {
  const first = Math.max(1, Math.min(200, Number(args.first ?? 50)));
  const recipient = String(args.recipient ?? "").trim().toLowerCase();
  const url = String(args.url ?? "").trim();
  const bypassCache = Boolean(args.bypassCache);
  const chainIdStr = typeof args.chainIdStr === "string" ? args.chainIdStr.trim() : "";

  if (!url || !recipient) return { items: [], schemaMismatch: false };

  const cacheKey = `socialBlockchainNetwork.notifications.${recipient}.${first}.${url}`;
  if (!bypassCache) {
    const cached = readLocalCache<{ items?: NotificationItem[]; schemaMismatch?: boolean; ts?: number }>(cacheKey);
    if (
      Array.isArray(cached?.items) &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < CACHE_TTL_MS
    ) {
      return { items: filterDeleted(cached.items, chainIdStr), schemaMismatch: Boolean(cached?.schemaMismatch) };
    }
  }

  const inFlightKey = bypassCache ? `${cacheKey}.fresh` : cacheKey;
  return await runInFlight(inFlight, inFlightKey, async () => {
    const query = `
      query Notifications($first: Int!, $recipient: ID!) {
        notifications(
          first: $first,
          orderBy: timestamp,
          orderDirection: desc,
          where: { recipient: $recipient }
        ) {
          id
          kind
          tokenId
          commentId
          timestamp
          actor {
            id
            name
            avatar
          }
        }
      }
    `;

    let data: { notifications: SubgraphNotificationRow[] };
    try {
      data = await querySubgraph<{ notifications: SubgraphNotificationRow[] }>({
        url,
        query,
        variables: { first, recipient } satisfies SubgraphVariables,
        timeoutMs: 8_000
      });
    } catch (err) {
      if (isLikelySubgraphSchemaMismatch(err)) {
        const res = { items: [], schemaMismatch: true };
        writeLocalCache(cacheKey, { ...res, ts: Date.now() });
        return res;
      }
      throw err;
    }

    const rows = Array.isArray(data?.notifications) ? data.notifications : [];
    const items: NotificationItem[] = rows
      .map((n) => {
        const id = String(n?.id ?? "");
        const actorId = typeof n?.actor === "object" && n.actor ? String(n.actor.id ?? "") : "";
        return {
          id,
          kind: String(n?.kind ?? ""),
          tokenId: String(n?.tokenId ?? ""),
          commentId: n?.commentId ?? null,
          chainId: chainIdStr || undefined,
          timestamp: toInt(n?.timestamp),
          actor: {
            id: actorId,
            name: typeof n?.actor === "object" && n.actor ? (n.actor.name ?? null) : null,
            avatar: typeof n?.actor === "object" && n.actor ? (n.actor.avatar ?? null) : null
          }
        };
      })
      .filter((n) => Boolean(n.id) && Boolean(n.actor.id) && Boolean(n.tokenId));

    let filtered = filterDeleted(items, chainIdStr);
    const burnedFromSubgraph = await fetchBurnedTokenIds(
      url,
      filtered.filter((n) => n.kind !== "POST_REMOVED_BY_ADMIN").map((n) => n.tokenId)
    );
    if (burnedFromSubgraph && burnedFromSubgraph.size > 0) {
      filtered = filtered.filter((n) => n.kind === "POST_REMOVED_BY_ADMIN" || !burnedFromSubgraph.has(n.tokenId));
    }

    const res = { items: filtered, schemaMismatch: false };
    writeLocalCache(cacheKey, { ...res, ts: Date.now() });
    return res;
  });
}
