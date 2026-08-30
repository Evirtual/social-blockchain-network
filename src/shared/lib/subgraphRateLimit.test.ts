import { afterEach, describe, expect, it } from "vitest";
import {
  SubgraphRateLimitError,
  clearRateLimit,
  getCooldownRemainingMs,
  getCooldownSource,
  noteRateLimited,
  parseRetryAfterMs,
  readRateLimitSource
} from "./subgraphRateLimit";

const URL_A = "https://social-posts-subgraph.example.workers.dev/eth-sepolia";
const URL_B = "https://social-posts-subgraph.example.workers.dev/bsc-testnet";
const OTHER_HOST = "https://api.studio.thegraph.com/query/1/x/version/latest";

afterEach(() => clearRateLimit());

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name] ?? null };
}

describe("parseRetryAfterMs", () => {
  it("reads a delay given in seconds", () => {
    expect(parseRetryAfterMs("60")).toBe(60_000);
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  it("reads a delay given as an HTTP date", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const at = new Date(now + 30_000).toUTCString();
    expect(parseRetryAfterMs(at, now)).toBe(30_000);
  });

  it("treats a date in the past as no delay", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const at = new Date(now - 30_000).toUTCString();
    expect(parseRetryAfterMs(at, now)).toBe(0);
  });

  it("falls back to a minute when the header is missing or unparseable", () => {
    expect(parseRetryAfterMs(null)).toBe(60_000);
    expect(parseRetryAfterMs("")).toBe(60_000);
    expect(parseRetryAfterMs("soon")).toBe(60_000);
  });

  it("caps absurd values so a bad header cannot disable a host for hours", () => {
    expect(parseRetryAfterMs("999999")).toBe(5 * 60_000);
  });
});

describe("cooldown tracking", () => {
  it("reports no cooldown for a host that has not been limited", () => {
    expect(getCooldownRemainingMs(URL_A)).toBe(0);
  });

  it("reports remaining time after a host is limited", () => {
    noteRateLimited(URL_A, 60_000, "worker");
    const remaining = getCooldownRemainingMs(URL_A);
    expect(remaining).toBeGreaterThan(55_000);
    expect(remaining).toBeLessThanOrEqual(60_000);
  });

  it("expires the cooldown once the window passes", () => {
    noteRateLimited(URL_A, 1_000, "worker");
    expect(getCooldownRemainingMs(URL_A, Date.now() + 2_000)).toBe(0);
  });

  it("shares one cooldown across routes on the same host", () => {
    // Both routes are served by the same worker, and the limit is per host.
    noteRateLimited(URL_A, 60_000, "worker");
    expect(getCooldownRemainingMs(URL_B)).toBeGreaterThan(0);
  });

  it("keeps hosts independent", () => {
    noteRateLimited(URL_A, 60_000, "worker");
    expect(getCooldownRemainingMs(OTHER_HOST)).toBe(0);
  });

  it("remembers which side imposed the limit", () => {
    noteRateLimited(URL_A, 60_000, "upstream");
    expect(getCooldownSource(URL_A)).toBe("upstream");
  });

  it("clears a single host without disturbing others", () => {
    noteRateLimited(URL_A, 60_000, "worker");
    noteRateLimited(OTHER_HOST, 60_000, "upstream");

    clearRateLimit(URL_A);

    expect(getCooldownRemainingMs(URL_A)).toBe(0);
    expect(getCooldownRemainingMs(OTHER_HOST)).toBeGreaterThan(0);
  });
});

describe("readRateLimitSource", () => {
  it("identifies our own worker by its header", () => {
    expect(readRateLimitSource(headers({ "X-RateLimit-Source": "worker" }))).toBe("worker");
  });

  it("treats an unlabelled 429 as coming from upstream", () => {
    // The Graph's own throttling is passed through by the worker untouched.
    expect(readRateLimitSource(headers({}))).toBe("upstream");
    expect(readRateLimitSource(headers({ "X-RateLimit-Source": "something-else" }))).toBe("upstream");
  });
});

describe("SubgraphRateLimitError", () => {
  it("stays recognisable to the shared error mapper", async () => {
    const { getErrorMessage } = await import("./errors");
    const err = new SubgraphRateLimitError(60_000, "worker");

    // The mapper keys off "429" in the message.
    expect(err.message).toContain("429");
    expect(getErrorMessage(err)).toMatch(/rate limit/i);
  });

  it("carries the delay and source for callers that want to show them", () => {
    const err = new SubgraphRateLimitError(30_000, "upstream");
    expect(err.retryAfterMs).toBe(30_000);
    expect(err.source).toBe("upstream");
  });
});
