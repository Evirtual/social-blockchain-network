type Env = {
  PINATA_JWT?: string;
  ALLOW_ORIGINS?: string;
};

const PINATA_BASE = "https://api.pinata.cloud/pinning";

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
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    ...(vary ? { Vary: vary } : {})
  };
}

function json(body: unknown, request: Request, env: Env, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...corsHeaders(request, env), ...(init.headers ?? {}) }
  });
}

async function forwardPinata(
  request: Request,
  env: Env,
  url: string,
  init?: RequestInit,
  baseHeaders?: HeadersInit
) {
  if (!env.PINATA_JWT) {
    return json({ error: "Missing PINATA_JWT" }, request, env, { status: 500 });
  }

  const headers = new Headers(baseHeaders ?? {});
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  headers.set("Authorization", `Bearer ${env.PINATA_JWT}`);

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
      ...corsHeaders(request, env)
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (request.method === "POST" && path === "/pin/file") {
      return await forwardPinata(request, env, `${PINATA_BASE}/pinFileToIPFS`, {
        method: "POST",
        body: request.body
      }, request.headers);
    }

    if (request.method === "POST" && path === "/pin/json") {
      return await forwardPinata(request, env, `${PINATA_BASE}/pinJSONToIPFS`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await request.text()
      });
    }

    if (request.method === "DELETE" && path.startsWith("/pin/")) {
      const cid = path.slice("/pin/".length);
      if (!cid) return json({ error: "Missing cid" }, request, env, { status: 400 });
      return await forwardPinata(request, env, `${PINATA_BASE}/unpin/${cid}`, {
        method: "DELETE"
      });
    }

    return json({ error: "Not found" }, request, env, { status: 404 });
  }
};
