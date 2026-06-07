type Env = {
  ORIGIN_GATEWAYS?: string;
  ALLOW_ORIGINS?: string;
  CACHE_TTL_OK_SECONDS?: string;
};

type OriginAttempt = {
  url: string;
  status: number | null;
  error: string | null;
};

function parseCsv(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeGatewayBase(raw: string): string {
  let base = String(raw ?? "").trim();
  if (!base) return "";
  if (!base.endsWith("/")) base = `${base}/`;
  const lower = base.toLowerCase();
  if (!lower.includes("/ipfs/")) base = `${base}ipfs/`;
  return base;
}

function getOriginGatewayBases(env: Env): string[] {
  const bases = parseCsv(env.ORIGIN_GATEWAYS).map(normalizeGatewayBase).filter(Boolean);
  return bases.length
    ? bases
    : [
        normalizeGatewayBase("https://gateway.pinata.cloud/ipfs/"),
        normalizeGatewayBase("https://dweb.link/ipfs/"),
        normalizeGatewayBase("https://w3s.link/ipfs/"),
        normalizeGatewayBase("https://ipfs.io/ipfs/")
      ];
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
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Range,If-None-Match,If-Modified-Since,Accept",
    "Access-Control-Expose-Headers":
      "Content-Length,Content-Range,Accept-Ranges,ETag,Last-Modified,Content-Type",
    ...(vary ? { Vary: vary } : {})
  };
}

function text(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    ...init,
    headers: { "content-type": "text/plain; charset=utf-8", ...(init.headers ?? {}) }
  });
}

function isLikelyHtml(res: Response, peek: string): boolean {
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("text/html")) return true;
  const trimmed = peek.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

function shouldRetryStatus(status: number): boolean {
  // Gateways can return 403/429 for rate limiting, 404 for missing propagation,
  // and 5xx/504 when they can't reach providers quickly enough.
  if (status === 403 || status === 404 || status === 408 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

function withCors(res: Response, request: Request, env: Env, extraHeaders?: Record<string, string>) {
  const headers = new Headers(res.headers);
  const cors = corsHeaders(request, env);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function cacheControlImmutable(ttlSeconds: number) {
  // CID-based paths are immutable.
  return `public, max-age=${ttlSeconds}, immutable`;
}

function parseCacheTtlSeconds(env: Env): number {
  const raw = String(env.CACHE_TTL_OK_SECONDS ?? "").trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 29030400;
}

function buildIpfsPathFromRequest(url: URL): string | null {
  const path = url.pathname;
  if (path === "/") return null;

  const normalized = path.replace(/\/+$/, "");
  if (normalized === "/ipfs" || normalized === "/ipns") return null;

  if (normalized.startsWith("/ipfs/")) return normalized.slice("/ipfs/".length);
  if (normalized.startsWith("/ipns/")) return `ipns/${normalized.slice("/ipns/".length)}`;

  // Allow requests like "/<cid>" (we'll treat as ipfs/<cid>).
  const trimmed = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  return trimmed ? trimmed : null;
}

function buildOriginUrl(originBase: string, ipfsPath: string, requestUrl: URL): string {
  // If ipfsPath already starts with "ipns/", originBase must be a site root (we'll normalize anyway).
  const base = normalizeGatewayBase(originBase);
  if (ipfsPath.startsWith("ipns/")) {
    const originRoot = base.replace(/ipfs\/?$/i, "");
    return `${originRoot}ipns/${ipfsPath.slice("ipns/".length)}${requestUrl.search}`;
  }
  return `${base}${ipfsPath}${requestUrl.search}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withCors(text("Method not allowed", { status: 405 }), request, env);
    }

    const url = new URL(request.url);
    const ipfsPath = buildIpfsPathFromRequest(url);
    if (!ipfsPath) {
      return withCors(
        text(
          "IPFS media proxy. Use /ipfs/<cid>[/path] or /ipns/<name>[/path].\n",
          { status: 200 }
        ),
        request,
        env
      );
    }

    const ttlSeconds = parseCacheTtlSeconds(env);

    const hasRange = request.headers.has("range");
    const cacheKey =
      request.method === "GET" && !hasRange ? new Request(url.toString(), { method: "GET" }) : null;

    if (cacheKey) {
      const cached = await caches.default.match(cacheKey);
      if (cached) return withCors(cached, request, env, { "X-Ipfs-Proxy-Cache": "HIT" });
    }

    const originBases = getOriginGatewayBases(env);
    const attempts: OriginAttempt[] = [];

    const forwardHeaders = new Headers();
    const passthrough = ["range", "if-none-match", "if-modified-since", "accept"];
    for (const key of passthrough) {
      const v = request.headers.get(key);
      if (v) forwardHeaders.set(key, v);
    }
    // Some gateways behave better when a UA is present.
    forwardHeaders.set("user-agent", request.headers.get("user-agent") || "sbnet-media-proxy/1.0");

    for (const base of originBases) {
      const originUrl = buildOriginUrl(base, ipfsPath, url);
      try {
        const res = await fetch(originUrl, {
          method: request.method,
          headers: forwardHeaders,
          redirect: "follow"
        });

        // Quick guard against "browser challenge" HTML pages (common on some gateways).
        if (!res.ok && shouldRetryStatus(res.status)) {
          const peek = await res.clone().text().catch(() => "");
          if (peek && isLikelyHtml(res, peek)) {
            attempts.push({ url: originUrl, status: res.status, error: "html-challenge" });
            continue;
          }
          attempts.push({ url: originUrl, status: res.status, error: null });
          continue;
        }

        if (!res.ok && res.status !== 206 && res.status !== 304) {
          attempts.push({ url: originUrl, status: res.status, error: null });
          continue;
        }

        const headers = new Headers(res.headers);
        headers.set("Cache-Control", cacheControlImmutable(ttlSeconds));
        headers.delete("set-cookie");
        headers.set("X-Ipfs-Proxy-Origin", new URL(originUrl).host);

        const out = withCors(new Response(res.body, { status: res.status, headers }), request, env, {
          "X-Ipfs-Proxy-Cache": "MISS"
        });

        if (cacheKey && res.ok && res.status !== 206 && request.method === "GET") {
          ctx.waitUntil(caches.default.put(cacheKey, out.clone()));
        }

        return out;
      } catch (error) {
        attempts.push({
          url: originUrl,
          status: null,
          error: error instanceof Error ? error.message : "fetch-failed"
        });
      }
    }

    const debug =
      attempts.length > 0
        ? `Tried:\n${attempts
            .map((a) => `- ${a.url} => ${a.status ?? "ERR"}${a.error ? ` (${a.error})` : ""}`)
            .join("\n")}\n`
        : "";

    return withCors(text(`Gateway timeout.\n${debug}`, { status: 504 }), request, env);
  }
};

