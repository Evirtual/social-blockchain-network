import { getEnv } from "@shared/lib/env";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";

const inFlight: InFlightMap<{ posted: number; saved: number; liked: number }> = {};

const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeSelectedChainIds(selectedChainIds: string[]): string[] {
  return (selectedChainIds ?? [])
    .filter((x) => typeof x === "string" && x.trim())
    .map((x) => x.trim())
    .slice()
    .sort();
}

export async function loadAccountCountsFromSubgraphs(args: {
  walletAddress: string;
  selectedChainIds: string[];
}): Promise<{ posted: number; saved: number; liked: number }> {
  const walletLower = String(args.walletAddress ?? "")
    .trim()
    .toLowerCase();
  const selectedIds = normalizeSelectedChainIds(args.selectedChainIds);

  const cacheKey = `socialBlockchainNetwork.account.counts.${walletLower}.${selectedIds.join(",")}`;

  return await runInFlight(inFlight, cacheKey, async () => {
    const cached = readSessionCache<{ posted?: number; saved?: number; liked?: number; ts?: number }>(cacheKey);
    if (
      typeof cached?.posted === "number" &&
      typeof cached?.saved === "number" &&
      typeof cached?.liked === "number" &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < CACHE_TTL_MS
    ) {
      return { posted: cached.posted, saved: cached.saved, liked: cached.liked };
    }

    const env = getEnv();
    let postedSum = 0;
    let savedSum = 0;
    let likedSum = 0;

    for (const id of selectedIds) {
      const chainIdNum = Number(id);
      if (!Number.isFinite(chainIdNum)) continue;
      const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
      if (!subgraphUrl) continue;

      const result = await tryQuerySubgraph<{
        account: { postedCount?: string | null; savedCount?: string | null; likedCount?: string | null } | null;
      }>({
        url: subgraphUrl,
        query: `query AccountCounts($id: ID!) { account(id: $id) { postedCount savedCount likedCount } }`,
        variables: { id: walletLower },
        timeoutMs: 8_000
      });

      if (!result.ok) continue;

      const posted = Number(result.data?.account?.postedCount ?? 0);
      const saved = Number(result.data?.account?.savedCount ?? 0);
      const liked = Number(result.data?.account?.likedCount ?? 0);

      if (Number.isFinite(posted)) postedSum += posted;
      if (Number.isFinite(saved)) savedSum += saved;
      if (Number.isFinite(liked)) likedSum += liked;
    }

    const resolved = { posted: postedSum, saved: savedSum, liked: likedSum };
    writeSessionCache(cacheKey, { ...resolved, ts: Date.now() });
    return resolved;
  });
}
