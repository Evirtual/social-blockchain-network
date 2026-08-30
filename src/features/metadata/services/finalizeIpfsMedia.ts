import type { TokenMetadata } from "@types";
import { fetchTokenMetadata } from "./metadata/fetch";
import { sleep } from "@shared/lib/time";

export async function waitForMetadataReady(
  tokenUri: string,
  attempts = 10,
  delayMs = 650
): Promise<TokenMetadata> {
  for (let i = 0; i < attempts; i++) {
    const meta = await fetchTokenMetadata(tokenUri);
    const hasAny =
      typeof meta.name === "string" ||
      typeof meta.description === "string" ||
      typeof meta.image === "string" ||
      typeof meta.animation_url === "string";
    if (hasAny) return meta;
    await sleep(delayMs);
  }

  return fetchTokenMetadata(tokenUri);
}

export async function bestEffortFinalizeIpfsMedia(tokenUri: string) {
  if (!tokenUri.startsWith("ipfs://")) return;

  try {
    await waitForMetadataReady(tokenUri, 5, 900);
  } catch {
    // ignore
  }
}
