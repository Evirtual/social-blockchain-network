import { withTimeout } from "./feedQuery";
import { getEnv, getEnvBoolean, getEnvString } from "./env";
import { getNetworkBadgeLabel } from "./chain";
import {
  SubgraphRateLimitError,
  getCooldownRemainingMs,
  getCooldownSource,
  noteRateLimited,
  parseRetryAfterMs,
  readRateLimitSource
} from "./subgraphRateLimit";

export type SubgraphVariables = Record<string, string | number | boolean | null | Array<string | number | boolean | null>>;

type SubgraphResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type SubgraphLogStats = {
  seq: number;
  total: number;
  ok: number;
  fail: number;
  byOp: Record<string, { total: number; ok: number; fail: number; msTotal: number }>;
  byHost: Record<string, { total: number; ok: number; fail: number; msTotal: number }>;
};

function getGlobalSubgraphStats(): SubgraphLogStats {
  const g = globalThis as unknown as {
    __socialBlockchainNetworkSubgraphStats?: SubgraphLogStats;
  };

  if (!g.__socialBlockchainNetworkSubgraphStats) {
    g.__socialBlockchainNetworkSubgraphStats = {
      seq: 0,
      total: 0,
      ok: 0,
      fail: 0,
      byOp: {},
      byHost: {}
    };
  }

  return g.__socialBlockchainNetworkSubgraphStats;
}

function parseOperationName(queryText: string): string {
  const s = String(queryText ?? "");
  const m = /\b(query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(s);
  return m?.[2] ?? "(anonymous)";
}

function safeHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function normalizeUrlForCompare(url: string): string {
  return String(url ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function getSubgraphLabelForUrl(env: ReturnType<typeof getEnv>, url: string): string {
  const target = normalizeUrlForCompare(url);
  const urlByChainId: Record<number, string | undefined> = {
    1: env?.VITE_ETH_SUBGRAPH_URL,
    11155111: env?.VITE_ETH_SEPOLIA_SUBGRAPH_URL,
    8453: env?.VITE_BASE_SUBGRAPH_URL,
    84532: env?.VITE_BASE_SEPOLIA_SUBGRAPH_URL,
    56: env?.VITE_BSC_SUBGRAPH_URL,
    97: env?.VITE_BSC_TESTNET_SUBGRAPH_URL
  };

  for (const [chainId, candidate] of Object.entries(urlByChainId)) {
    if (!candidate) continue;
    if (normalizeUrlForCompare(candidate) === target) {
      return getNetworkBadgeLabel(chainId);
    }
  }

  return "";
}

function summarizeVariables(vars: SubgraphVariables | undefined): Record<string, string | number | boolean | null> {
  const v = vars ?? {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, raw] of Object.entries(v)) {
    if (Array.isArray(raw)) {
      out[k] = `array(${raw.length})`;
    } else if (typeof raw === "string") {
      const s = raw.trim();
      out[k] = s.length > 64 ? `${s.slice(0, 64)}…` : s;
    } else if (typeof raw === "number" || typeof raw === "boolean" || raw === null) {
      out[k] = raw;
    } else {
      out[k] = String(raw);
    }
  }
  return out;
}

function bumpStats(stats: SubgraphLogStats, key: string, ok: boolean, ms: number): void {
  const bucket = (stats.byOp[key] ??= { total: 0, ok: 0, fail: 0, msTotal: 0 });
  bucket.total += 1;
  bucket.msTotal += ms;
  if (ok) bucket.ok += 1;
  else bucket.fail += 1;
}

function bumpHostStats(stats: SubgraphLogStats, key: string, ok: boolean, ms: number): void {
  const bucket = (stats.byHost[key] ??= { total: 0, ok: 0, fail: 0, msTotal: 0 });
  bucket.total += 1;
  bucket.msTotal += ms;
  if (ok) bucket.ok += 1;
  else bucket.fail += 1;
}

function printSummary(stats: SubgraphLogStats): void {
  const topOps = Object.entries(stats.byOp)
    .map(([name, v]) => ({
      op: name,
      total: v.total,
      ok: v.ok,
      fail: v.fail,
      avgMs: v.total ? Math.round(v.msTotal / v.total) : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const topHosts = Object.entries(stats.byHost)
    .map(([host, v]) => ({
      host,
      total: v.total,
      ok: v.ok,
      fail: v.fail,
      avgMs: v.total ? Math.round(v.msTotal / v.total) : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%cSubgraph summary%c total=${stats.total} ok=${stats.ok} fail=${stats.fail}`,
    "color:#8b5cf6;font-weight:700",
    "color:inherit"
  );
  // eslint-disable-next-line no-console
  console.table(topOps);
  // eslint-disable-next-line no-console
  console.table(topHosts);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export async function querySubgraph<T>(args: {
  url: string;
  query: string;
  variables?: SubgraphVariables;
  timeoutMs?: number;
}): Promise<T> {
  const env = getEnv();
  // Statically false in a production build, so the logging helpers below are
  // dropped from the bundle rather than shipped and never run. They are a
  // development diagnostic - the request counts they produce are what located
  // the rate limiting - and are worth keeping for that, not for shipping.
  const logEnabled = import.meta.env.DEV && getEnvBoolean(env, "VITE_SUBGRAPH_LOG", false);
  const summaryEveryRaw = getEnvString(env, "VITE_SUBGRAPH_LOG_SUMMARY_EVERY");
  const summaryEvery = Math.max(1, Math.min(500, Number(summaryEveryRaw ?? 25)));

  const opName = parseOperationName(args.query);
  const varsSummary = logEnabled ? summarizeVariables(args.variables) : null;

  const url = String(args.url ?? "").trim();
  if (!url) throw new Error("Subgraph URL is missing.");

  const host = logEnabled ? safeHost(url) : "";
  const label = logEnabled ? getSubgraphLabelForUrl(env, url) : "";
  const hostLabel = logEnabled && label ? `${host} (${label})` : host;
  const stats = logEnabled ? getGlobalSubgraphStats() : null;
  const reqId = logEnabled && stats ? ++stats.seq : 0;
  const start = logEnabled ? performance.now() : 0;

  const timeoutMs = Number(args.timeoutMs ?? 10_000);

  const task = (async () => {
    // Fail fast while a cooldown is in effect rather than adding to the load
    // that caused it.
    const cooldownMs = getCooldownRemainingMs(url);
    if (cooldownMs > 0) {
      throw new SubgraphRateLimitError(cooldownMs, getCooldownSource(url) ?? "worker");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: args.query, variables: args.variables ?? {} })
    });

    if (res.status === 429) {
      const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
      const source = readRateLimitSource(res.headers);
      noteRateLimited(url, retryAfterMs, source);
      throw new SubgraphRateLimitError(retryAfterMs, source);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Subgraph HTTP ${res.status}: ${text || res.statusText}`);
    }

    const json = (await res.json()) as SubgraphResponse<T>;
    if (json?.errors?.length) {
      const msg = String(json.errors?.[0]?.message ?? "Subgraph query failed");
      throw new Error(msg);
    }

    if (!json || !json.data) {
      throw new Error("Subgraph query returned no data.");
    }

    return json.data;
  })();

  try {
    const data = await withTimeout(task, timeoutMs, "subgraph query");
    if (logEnabled && stats) {
      const ms = Math.max(0, Math.round(performance.now() - start));
      stats.total += 1;
      stats.ok += 1;
      bumpStats(stats, opName, true, ms);
      bumpHostStats(stats, hostLabel, true, ms);

      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `%cSubgraph%c #${reqId} %c✓%c ${opName} %c${ms}ms%c %c${hostLabel}`,
        "color:#2563eb;font-weight:700",
        "color:inherit",
        "color:#16a34a;font-weight:700",
        "color:inherit",
        "color:#111827;font-weight:700",
        "color:inherit",
        "color:#6b7280"
      );
      // eslint-disable-next-line no-console
      console.log("url", url);
      if (varsSummary && Object.keys(varsSummary).length) {
        // eslint-disable-next-line no-console
        console.log("vars", varsSummary);
      }
      // eslint-disable-next-line no-console
      console.groupEnd();

      if (stats.total % summaryEvery === 0) printSummary(stats);
    }

    return data;
  } catch (error) {
    if (logEnabled && stats) {
      const ms = Math.max(0, Math.round(performance.now() - start));
      const err = error instanceof Error ? error : new Error(String(error));

      stats.total += 1;
      stats.fail += 1;
      bumpStats(stats, opName, false, ms);
      bumpHostStats(stats, hostLabel, false, ms);

      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `%cSubgraph%c #${reqId} %c✗%c ${opName} %c${ms}ms%c %c${hostLabel}`,
        "color:#2563eb;font-weight:700",
        "color:inherit",
        "color:#dc2626;font-weight:700",
        "color:inherit",
        "color:#111827;font-weight:700",
        "color:inherit",
        "color:#6b7280"
      );
      // eslint-disable-next-line no-console
      console.log("url", url);
      if (varsSummary && Object.keys(varsSummary).length) {
        // eslint-disable-next-line no-console
        console.log("vars", varsSummary);
      }
      // eslint-disable-next-line no-console
      console.warn("error", err.message);
      // eslint-disable-next-line no-console
      console.groupEnd();

      if (stats.total % summaryEvery === 0) printSummary(stats);
    }
    throw error;
  }
}

export async function tryQuerySubgraph<T>(args: {
  url: string;
  query: string;
  variables?: SubgraphVariables;
  timeoutMs?: number;
}): Promise<{ ok: true; data: T } | { ok: false; error: Error }> {
  try {
    const data = await querySubgraph<T>(args);
    return { ok: true, data };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { ok: false, error: err };
  }
}
