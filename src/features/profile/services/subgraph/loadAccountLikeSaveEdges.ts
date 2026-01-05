import { getEnv } from "@shared/lib/env";
import { runInFlight, type InFlightMap } from "@shared/lib/inFlight";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { querySubgraph } from "@shared/lib/subgraphQuery";
import { parseChainIdNumber } from "@shared/lib/rpc";

type Result = {
  likedTokenIds: string[];
  savedTokenIds: string[];
};

const inFlight: InFlightMap<Result | null> = {};

const CACHE_TTL_MS = 60 * 1000;

export async function loadAccountLikeSaveEdgesFromSubgraph(args: {
  chainIdStr: string;
  account: string;
  first?: number;
}): Promise<Result | null> {
  const chainIdStr = String(args.chainIdStr ?? "").trim();
  const accountLower = String(args.account ?? "")
    .trim()
    .toLowerCase();

  if (!chainIdStr || !accountLower) return null;

  const first = Math.max(1, Math.min(5000, Number(args.first ?? 1000)));
  const cacheKey = `socialBlockchainNetwork.profile.likeSaveEdges.${chainIdStr.toLowerCase()}.${accountLower}`;

  return await runInFlight(inFlight, cacheKey, async () => {
    const cached = readSessionCache<{ likedTokenIds?: string[]; savedTokenIds?: string[]; ts?: number }>(cacheKey);
    if (
      Array.isArray(cached?.likedTokenIds) &&
      Array.isArray(cached?.savedTokenIds) &&
      typeof cached?.ts === "number" &&
      Date.now() - cached.ts < CACHE_TTL_MS
    ) {
      return {
        likedTokenIds: cached.likedTokenIds.map((t) => String(t ?? "").trim()).filter(Boolean),
        savedTokenIds: cached.savedTokenIds.map((t) => String(t ?? "").trim()).filter(Boolean)
      };
    }

    const env = getEnv();
    const chainIdNum = parseChainIdNumber(chainIdStr);
    if (!chainIdNum) return null;

    const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
    if (!subgraphUrl) return null;

    const query = `
      query AccountLikesAndSaves($account: ID!, $first: Int!) {
        likes: likeEdges(
          first: $first,
          where: { account: $account, active: true },
          orderBy: updatedAtBlock,
          orderDirection: desc
        ) {
          tokenId
        }
        saves: saveEdges(
          first: $first,
          where: { account: $account, active: true },
          orderBy: updatedAtBlock,
          orderDirection: desc
        ) {
          tokenId
        }
      }
    `;

    const data = await querySubgraph<{
      likes: Array<{ tokenId: string }>;
      saves: Array<{ tokenId: string }>;
    }>({
      url: subgraphUrl,
      query,
      variables: { account: accountLower, first },
      timeoutMs: 10_000
    });

    const likedTokenIds = (Array.isArray(data?.likes) ? data.likes : [])
      .map((e) => String(e?.tokenId ?? "").trim())
      .filter(Boolean);

    const savedTokenIds = (Array.isArray(data?.saves) ? data.saves : [])
      .map((e) => String(e?.tokenId ?? "").trim())
      .filter(Boolean);

    const result = {
      likedTokenIds,
      savedTokenIds
    } satisfies Result;

    writeSessionCache(cacheKey, {
      likedTokenIds,
      savedTokenIds,
      ts: Date.now()
    });

    return result;
  });
}
