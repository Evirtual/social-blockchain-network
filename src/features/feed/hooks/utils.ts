import type { Post } from "@types";

export function postKey(p: Pick<Post, "tokenId" | "chainId">) {
  return `${p.chainId ?? ""}:${p.tokenId}`;
}

export function commentKey(chainId: string | null | undefined, tokenId: string) {
  return chainId ? `${chainId}:${tokenId}` : tokenId;
}
