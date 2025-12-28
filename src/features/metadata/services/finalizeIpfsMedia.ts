import type { TokenMetadata } from "@types";
import { ipfsToHttp } from "../../ipfs";
import { fetchTokenMetadata } from "./metadata/fetch";
import { sleep } from "@shared/lib/time";

export async function waitForUrlReachable(
  url: string,
  attempts = 10,
  delayMs = 650,
  timeoutMs = 2500
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const t = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const head = await fetch(url, { method: "HEAD", signal: controller.signal, cache: "no-store" });
        if (head.ok) return true;
      } catch {
        // fall through
      } finally {
        window.clearTimeout(t);
      }

      const controller2 = new AbortController();
      const t2 = window.setTimeout(() => controller2.abort(), timeoutMs);
      try {
        const probe = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          signal: controller2.signal,
          cache: "no-store"
        });
        if (probe.ok) return true;
      } catch {
        // ignore
      } finally {
        window.clearTimeout(t2);
      }
    } catch {
      // ignore
    }

    await sleep(delayMs);
  }

  return false;
}

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
    await waitForUrlReachable(ipfsToHttp(tokenUri), 10, 650);
    const meta = await waitForMetadataReady(tokenUri, 10, 650);

    const mediaRef =
      (typeof meta.animation_url === "string" && meta.animation_url.trim()) ||
      (typeof meta.image === "string" && meta.image.trim()) ||
      "";

    if (mediaRef && mediaRef.startsWith("ipfs://")) {
      await waitForUrlReachable(ipfsToHttp(mediaRef), 12, 650);
    }
  } catch {
    // ignore
  }
}
