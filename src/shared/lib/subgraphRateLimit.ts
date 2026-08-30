/**
 * Tracks which subgraph hosts are currently rate limited.
 *
 * The app fans a single on-chain event out to several independent readers, so a
 * 429 tends to arrive for all of them at once. Without a shared record each one
 * retries on its own schedule and keeps the limit tripped. Recording the
 * cooldown in one place lets later callers fail fast instead of piling on.
 */

export type RateLimitSource = "worker" | "upstream";

export class SubgraphRateLimitError extends Error {
  readonly retryAfterMs: number;
  readonly source: RateLimitSource;

  constructor(host: string, retryAfterMs: number, source: RateLimitSource) {
    const seconds = Math.ceil(retryAfterMs / 1000);
    super(`Subgraph HTTP 429: rate limited by ${source} (retry in ~${seconds}s)`);
    this.name = "SubgraphRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.source = source;
    // Keeps the shared error mapper's `includes("429")` branch working.
    void host;
  }
}

const DEFAULT_RETRY_AFTER_MS = 60_000;
const MAX_RETRY_AFTER_MS = 5 * 60_000;

const cooldowns = new Map<string, { until: number; source: RateLimitSource }>();

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** `Retry-After` may be seconds or an HTTP date; both are accepted. */
export function parseRetryAfterMs(value: string | null, now = Date.now()): number {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_RETRY_AFTER_MS;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.round(seconds * 1000));
  }

  const at = Date.parse(raw);
  if (Number.isFinite(at)) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, at - now));
  }

  return DEFAULT_RETRY_AFTER_MS;
}

export function noteRateLimited(url: string, retryAfterMs: number, source: RateLimitSource): void {
  const ms = Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAfterMs));
  cooldowns.set(hostOf(url), { until: Date.now() + ms, source });
}

/** Milliseconds left on this host's cooldown, or 0 when it is free to use. */
export function getCooldownRemainingMs(url: string, now = Date.now()): number {
  const entry = cooldowns.get(hostOf(url));
  if (!entry) return 0;
  if (entry.until <= now) {
    cooldowns.delete(hostOf(url));
    return 0;
  }
  return entry.until - now;
}

export function getCooldownSource(url: string): RateLimitSource | null {
  return cooldowns.get(hostOf(url))?.source ?? null;
}

export function clearRateLimit(url?: string): void {
  if (url) cooldowns.delete(hostOf(url));
  else cooldowns.clear();
}

/**
 * Distinguishes our own worker's limit from The Graph's. The worker sets an
 * explicit header; anything else reaching us as a 429 came from upstream.
 */
export function readRateLimitSource(headers: {
  get: (name: string) => string | null;
}): RateLimitSource {
  return headers.get("X-RateLimit-Source") === "worker" ? "worker" : "upstream";
}
