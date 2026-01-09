type Env = {
  PINATA_JWT?: string;
};

const PINATA_BASE = "https://api.pinata.cloud/pinning";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...corsHeaders(), ...(init.headers ?? {}) }
  });
}

async function forwardPinata(request: Request, env: Env, url: string, init?: RequestInit) {
  if (!env.PINATA_JWT) {
    return json({ error: "Missing PINATA_JWT" }, { status: 500 });
  }

  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${env.PINATA_JWT}`);

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json", ...corsHeaders() }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (request.method === "POST" && path === "/pin/file") {
      return await forwardPinata(request, env, `${PINATA_BASE}/pinFileToIPFS`, {
        method: "POST",
        body: request.body
      });
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
      if (!cid) return json({ error: "Missing cid" }, { status: 400 });
      return await forwardPinata(request, env, `${PINATA_BASE}/unpin/${cid}`, {
        method: "DELETE"
      });
    }

    return json({ error: "Not found" }, { status: 404 });
  }
};
