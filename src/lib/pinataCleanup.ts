import { extractIpfsCid, hasPinata, pinataUnpinCid } from "../ipfs";
import { fetchTokenMetadata } from "./metadata";
import type { Post } from "../types";

export async function collectIpfsCidsFromTokenUri(tokenUri: string): Promise<Set<string>> {
  const out = new Set<string>();
  const metaCid = extractIpfsCid(tokenUri);
  if (metaCid) out.add(metaCid);

  const meta = await fetchTokenMetadata(tokenUri);
  const imageCid = extractIpfsCid(String(meta?.image ?? ""));
  if (imageCid) out.add(imageCid);
  const animCid = extractIpfsCid(String((meta as any)?.animation_url ?? ""));
  if (animCid) out.add(animCid);

  return out;
}

export function collectReferencedIpfsCidsFromPosts(
  posts: Array<Pick<Post, "tokenId" | "chainId" | "metadataURI" | "image" | "animationUrl">>,
  options?: { exclude?: { chainId?: string | null; tokenIds?: Iterable<string> } }
): Set<string> {
  const out = new Set<string>();
  const excludeChain = options?.exclude?.chainId ? String(options.exclude.chainId).trim() : "";
  const excludeTokenIds = new Set(
    Array.from(options?.exclude?.tokenIds ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean)
  );

  for (const p of posts) {
    if (excludeTokenIds.size > 0 && excludeChain) {
      if (String(p.chainId ?? "").trim() === excludeChain && excludeTokenIds.has(String(p.tokenId ?? "").trim())) {
        continue;
      }
    }

    const refs = [p.metadataURI, p.image, p.animationUrl].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    for (const ref of refs) {
      const cid = extractIpfsCid(ref);
      if (cid) out.add(cid);
    }
  }

  return out;
}

export async function bestEffortUnpinCids(
  cids: Iterable<string>,
  options?: { protectReferencedIn?: Set<string> }
) {
  if (!hasPinata()) return;

  const unique = Array.from(new Set(Array.from(cids).map((c) => String(c).trim()).filter(Boolean)));
  if (!unique.length) return;

  const protect = options?.protectReferencedIn;
  const filtered = protect ? unique.filter((cid) => !protect.has(cid)) : unique;
  if (!filtered.length) return;

  await Promise.allSettled(filtered.map((cid) => pinataUnpinCid(cid)));
}
