import type { Post } from "@types";
import { getNetworkBadgeLabel } from "@shared/lib/chain";
import { parseChainIdNumber } from "@shared/lib/chainId";

export function postKey(p: Pick<Post, "tokenId" | "chainId">) {
  return `${p.chainId ?? ""}:${p.tokenId}`;
}

export function postKeyFromParts(chainId: string | null | undefined, tokenId: string) {
  return `${chainId ?? ""}:${tokenId}`;
}

export function parsePostKey(key: string) {
  const idx = key.indexOf(":");
  if (idx < 0) return null;
  const chainPart = key.slice(0, idx);
  const tokenId = key.slice(idx + 1);
  if (!tokenId) return null;
  return { chainId: chainPart || null, tokenId };
}

export function commentKey(chainId: string | null | undefined, tokenId: string) {
  return chainId ? `${chainId}:${tokenId}` : tokenId;
}

export function getPostUrl(postChainId: string | null | undefined, tokenId: string) {
  return postChainId ? `/post/${postChainId}/${tokenId}` : `/post/${tokenId}`;
}

export function getPostNetworkUi(params: {
  postChainId: string | null | undefined;
  chainId: string | null;
  walletAddress: string | null;
}) {
  const { postChainId, chainId, walletAddress } = params;

  const postNetworkLabel = postChainId ? getNetworkBadgeLabel(postChainId) : "";
  const walletChainIdNum = parseChainIdNumber(chainId);
  const postChainIdNum = parseChainIdNumber(postChainId ?? null);
  const isCurrentNetworkPost =
    walletChainIdNum != null && postChainIdNum != null && walletChainIdNum === postChainIdNum;
  const requiresNetworkSwitch =
    !!walletAddress && walletChainIdNum != null && postChainIdNum != null && walletChainIdNum !== postChainIdNum;
  const interactionDisabledTitle = requiresNetworkSwitch
    ? `Switch to ${postNetworkLabel} to interact with this post.`
    : undefined;

  return { postNetworkLabel, isCurrentNetworkPost, requiresNetworkSwitch, interactionDisabledTitle };
}
