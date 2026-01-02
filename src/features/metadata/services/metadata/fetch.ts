import type { TokenMetadata } from "@types";
import { ipfsToHttpCandidates } from "@features/ipfs";
import { parseTokenMetadataFromDataUri, parseTokenMetadataJson, type TokenMetadataJson } from "./parse";

type TokenMetadataFetchResult = { value: TokenMetadata; ok: boolean };

async function fetchTokenMetadataFromNetwork(tokenUri: string): Promise<TokenMetadataFetchResult> {
  const urls = ipfsToHttpCandidates(tokenUri);
  const totalTimeoutMs = 4_500;
  const perAttemptTimeoutMs = Math.max(1_500, Math.floor(totalTimeoutMs / Math.max(1, urls.length)));

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), perAttemptTimeoutMs);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      window.clearTimeout(timeoutId);

      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as TokenMetadataJson | null;
      if (!json || typeof json !== "object") continue;
      return { value: parseTokenMetadataJson(json), ok: true };
    } catch {
      // Try next gateway.
    }
  }

  return { value: {}, ok: false };
}

export async function fetchTokenMetadata(tokenUri: string): Promise<TokenMetadata> {
  if (!tokenUri) return {};

  // Old local-demo format.
  if (tokenUri.startsWith("data:application/json;base64,")) {
    try {
      return parseTokenMetadataFromDataUri(tokenUri);
    } catch {
      return {};
    }
  }

  // IPFS/http(s) metadata.
  const result: TokenMetadataFetchResult = await fetchTokenMetadataFromNetwork(tokenUri);
  return result.value;
}
