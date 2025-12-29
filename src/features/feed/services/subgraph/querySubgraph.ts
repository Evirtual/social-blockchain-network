import { withTimeout } from "@shared/lib/feedQuery";

export async function querySubgraph<T>(args: {
  url: string;
  query: string;
  variables?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const url = String(args.url ?? "").trim();
  if (!url) throw new Error("Subgraph URL is missing.");

  const timeoutMs = Number(args.timeoutMs ?? 10_000);

  const task = (async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: args.query, variables: args.variables ?? {} })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Subgraph HTTP ${res.status}: ${text || res.statusText}`);
    }

    const json = (await res.json()) as any;
    if (json?.errors?.length) {
      const msg = String(json.errors?.[0]?.message ?? "Subgraph query failed");
      throw new Error(msg);
    }

    return json?.data as T;
  })();

  return await withTimeout(task, timeoutMs, "subgraph query");
}
