import type { NotificationItem } from "../types";
import { querySubgraph, type SubgraphVariables } from "@shared/lib/subgraphQuery";
import { isLikelySubgraphSchemaMismatch } from "@shared/lib/subgraphSchemaMismatch";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";

const inFlight: InFlightMap<{ items: NotificationItem[]; schemaMismatch: boolean }> = {};
const CACHE_TTL_MS = 20 * 1000;

function toInt(v: string | number | bigint | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
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
}): Promise<{ items: NotificationItem[]; schemaMismatch: boolean }> {
  const first = Math.max(1, Math.min(200, Number(args.first ?? 50)));
  const recipient = String(args.recipient ?? "").trim().toLowerCase();
  const url = String(args.url ?? "").trim();
  const bypassCache = Boolean(args.bypassCache);

  if (!url || !recipient) return { items: [], schemaMismatch: false };

  const cacheKey = `socialBlockchainNetwork.notifications.${recipient}.${first}.${url}`;
  if (!bypassCache) {
    const cached = readSessionCache<{ items?: NotificationItem[]; schemaMismatch?: boolean; ts?: number }>(cacheKey);
    if (
      Array.isArray(cached?.items) &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < CACHE_TTL_MS
    ) {
      return { items: cached.items, schemaMismatch: Boolean(cached?.schemaMismatch) };
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
        writeSessionCache(cacheKey, { ...res, ts: Date.now() });
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
          timestamp: toInt(n?.timestamp),
          actor: {
            id: actorId,
            name: typeof n?.actor === "object" && n.actor ? (n.actor.name ?? null) : null,
            avatar: typeof n?.actor === "object" && n.actor ? (n.actor.avatar ?? null) : null
          }
        };
      })
      .filter((n) => Boolean(n.id) && Boolean(n.actor.id) && Boolean(n.tokenId));

    const res = { items, schemaMismatch: false };
    writeSessionCache(cacheKey, { ...res, ts: Date.now() });
    return res;
  });
}
