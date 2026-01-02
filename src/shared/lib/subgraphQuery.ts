import { withTimeout } from "./feedQuery";

export type SubgraphVariables = Record<string, string | number | boolean | null | Array<string | number | boolean | null>>;

type SubgraphResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

export async function querySubgraph<T>(args: {
  url: string;
  query: string;
  variables?: SubgraphVariables;
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

  return await withTimeout(task, timeoutMs, "subgraph query");
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
