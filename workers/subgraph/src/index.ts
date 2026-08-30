type Env = {
  ALLOW_ORIGINS?: string;
  FRESH_TTL_SECONDS?: string;
  STALE_TTL_SECONDS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;

  SUBGRAPH_ETH_URL?: string;
  SUBGRAPH_ETH_SEPOLIA_URL?: string;
  SUBGRAPH_BASE_URL?: string;
  SUBGRAPH_BASE_SEPOLIA_URL?: string;
  SUBGRAPH_BSC_URL?: string;
  SUBGRAPH_BSC_TESTNET_URL?: string;
};

type RouteKey = "eth" | "eth-sepolia" | "base" | "base-sepolia" | "bsc" | "bsc-testnet";

function parseCsv(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickAllowOrigin(request: Request, env: Env): string {
  const configured = parseCsv(env.ALLOW_ORIGINS);
  if (!configured.length) return "*";
  if (configured.includes("*")) return "*";

  const origin = request.headers.get("origin");
  if (!origin) return configured[0]!;
  return configured.includes(origin) ? origin : configured[0]!;
}

function corsHeaders(request: Request, env: Env) {
  const allowOrigin = pickAllowOrigin(request, env);
  const vary = allowOrigin === "*" ? "" : "Origin";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Access-Control-Expose-Headers":
      "Content-Type,Cache-Control,ETag,X-Subgraph-Cache,X-Subgraph-Origin,X-RateLimit-Source,X-RateLimit-Limit,Retry-After",
    ...(vary ? { Vary: vary } : {})
  };
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) }
  });
}

function withCors(res: Response, request: Request, env: Env, extraHeaders?: Record<string, string>) {
  const headers = new Headers(res.headers);
  const cors = corsHeaders(request, env);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function normalizeUrl(raw: string | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function getUpstreamForRoute(env: Env, route: RouteKey): string {
  const map: Record<RouteKey, string | undefined> = {
    eth: env.SUBGRAPH_ETH_URL,
    "eth-sepolia": env.SUBGRAPH_ETH_SEPOLIA_URL,
    base: env.SUBGRAPH_BASE_URL,
    "base-sepolia": env.SUBGRAPH_BASE_SEPOLIA_URL,
    bsc: env.SUBGRAPH_BSC_URL,
    "bsc-testnet": env.SUBGRAPH_BSC_TESTNET_URL
  };
  return normalizeUrl(map[route]);
}

function parsePositiveInt(raw: string | undefined, fallback: number, min = 1, max = 60 * 60 * 24): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseRouteFromPathname(pathname: string): RouteKey | null {
  const p = pathname.replace(/\/+$/, "");
  if (p === "" || p === "/") return null;
  const seg = p.startsWith("/") ? p.slice(1) : p;
  if (!seg) return null;

  const allowed: RouteKey[] = ["eth", "eth-sepolia", "base", "base-sepolia", "bsc", "bsc-testnet"];
  return (allowed as string[]).includes(seg) ? (seg as RouteKey) : null;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, "0");
  return out;
}

async function checkRateLimit(request: Request, env: Env, route: RouteKey): Promise<{ ok: boolean; remaining: number }> {
  const max = parsePositiveInt(env.RATE_LIMIT_MAX_REQUESTS, 60, 1, 10_000);
  const windowSeconds = parsePositiveInt(env.RATE_LIMIT_WINDOW_SECONDS, 60, 1, 3600);
  const ip = getClientIp(request);
  if (!ip) return { ok: true, remaining: max };

  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const cacheUrl = `https://rate-limit.local/${route}/${bucket}/${encodeURIComponent(ip)}`;
  const cacheReq = new Request(cacheUrl, { method: "GET" });

  let count = 0;
  const cached = await caches.default.match(cacheReq);
  if (cached) {
    const txt = await cached.text().catch(() => "");
    const n = Number(txt);
    count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  if (count >= max) return { ok: false, remaining: 0 };

  // Best-effort increment. Not atomic, but good enough for casual bot pressure.
  const next = count + 1;
  const res = new Response(String(next), {
    headers: { "Cache-Control": `public, max-age=${windowSeconds}` }
  });
  await caches.default.put(cacheReq, res);
  return { ok: true, remaining: Math.max(0, max - next) };
}

function cacheControlPublic(ttlSeconds: number) {
  return `public, max-age=${ttlSeconds}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    const route = parseRouteFromPathname(url.pathname);
    if (!route) {
      return withCors(
        json(
          {
            ok: true,
            routes: ["eth", "eth-sepolia", "base", "base-sepolia", "bsc", "bsc-testnet"],
            note: "POST GraphQL JSON to /<route> to proxy a subgraph endpoint."
          },
          { status: 200 }
        ),
        request,
        env
      );
    }

    if (request.method !== "POST") {
      return withCors(json({ error: "Method not allowed" }, { status: 405 }), request, env);
    }

    const upstream = getUpstreamForRoute(env, route);
    if (!upstream) {
      return withCors(json({ error: "Subgraph route not configured" }, { status: 404 }), request, env);
    }

    const freshTtl = parsePositiveInt(env.FRESH_TTL_SECONDS, 10, 1, 3600);
    const staleTtl = Math.max(freshTtl, parsePositiveInt(env.STALE_TTL_SECONDS, 120, 1, 24 * 3600));

    // Cache key based on route + request body hash. GraphQL POST bodies are deterministic.
    const bodyBuf = await request.arrayBuffer();
    const bodyHash = await sha256Hex(bodyBuf);
    const cacheKeyUrl = `https://subgraph-cache.local/${route}/${bodyHash}`;
    const cacheReq = new Request(cacheKeyUrl, { method: "GET" });

    const cached = await caches.default.match(cacheReq);
    const cachedAgeSeconds = cached
      ? (() => {
          const cachedAt = Number(cached.headers.get("X-Subgraph-Cached-At") ?? "0");
          return cachedAt ? Math.max(0, Math.floor((Date.now() - cachedAt) / 1000)) : staleTtl + 1;
        })()
      : null;

    // The cache is consulted before the rate limiter on purpose. A hit costs
    // nothing and never reaches upstream, so charging it against the caller's
    // budget would throttle the very requests the cache exists to absorb.
    if (cached && cachedAgeSeconds !== null && cachedAgeSeconds <= freshTtl) {
      return withCors(cached, request, env, {
        "X-Subgraph-Cache": "HIT",
        "Cache-Control": cacheControlPublic(freshTtl)
      });
    }

    // Only requests that will actually hit upstream are rate limited.
    const rate = await checkRateLimit(request, env, route);
    if (!rate.ok) {
      // Prefer serving stale data over failing: a slightly old feed beats an
      // error, and it keeps a shared NAT address from breaking the app for
      // everyone behind it.
      if (cached) {
        return withCors(cached, request, env, {
          "X-Subgraph-Cache": "STALE-RATE-LIMITED",
          "Cache-Control": cacheControlPublic(3)
        });
      }

      return withCors(
        json(
          { error: "Rate limited", source: "worker" },
          {
            status: 429,
            headers: {
              "Retry-After": "60",
              // Lets the client tell this apart from an upstream 429, which is
              // passed through with the origin's own status and body.
              "X-RateLimit-Source": "worker",
              "X-RateLimit-Limit": String(parsePositiveInt(env.RATE_LIMIT_MAX_REQUESTS, 60, 1, 10_000))
            }
          }
        ),
        request,
        env
      );
    }

    const upstreamUrl = upstream;
    const upstreamHost = (() => {
      try {
        return new URL(upstreamUrl).host;
      } catch {
        return upstreamUrl;
      }
    })();

    try {
      const res = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": request.headers.get("user-agent") || "sbnet-subgraph-proxy/1.0"
        },
        body: bodyBuf
      });

      const payload = await res.text().catch(() => "");

      const headers = new Headers(res.headers);
      headers.delete("set-cookie");
      headers.set("content-type", headers.get("content-type") || "application/json");
      headers.set("Cache-Control", cacheControlPublic(freshTtl));
      headers.set("X-Subgraph-Origin", upstreamHost);
      headers.set("X-Subgraph-Cache", "MISS");

      const out = withCors(new Response(payload, { status: res.status, headers }), request, env);

      if (res.ok) {
        const toStoreHeaders = new Headers(out.headers);
        toStoreHeaders.set("Cache-Control", cacheControlPublic(staleTtl));
        toStoreHeaders.set("X-Subgraph-Cached-At", String(Date.now()));
        toStoreHeaders.set("X-Subgraph-Cache", "HIT");
        const toStore = new Response(payload, { status: out.status, headers: toStoreHeaders });
        ctx.waitUntil(caches.default.put(cacheReq, toStore));
      }

      return out;
    } catch (error) {
      if (cached) {
        return withCors(
          cached,
          request,
          env,
          {
            "X-Subgraph-Cache": "STALE",
            "Cache-Control": cacheControlPublic(3)
          }
        );
      }

      const msg = error instanceof Error ? error.message : String(error);
      return withCors(json({ error: "Upstream fetch failed", detail: msg }, { status: 502 }), request, env);
    }
  }
};
