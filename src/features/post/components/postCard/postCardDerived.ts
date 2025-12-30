import { ipfsToHttp } from "@features/ipfs";
import { getNetworkBadgeLabel } from "@shared/lib/chain";
import { parseChainIdNumber } from "@shared/lib/chainId";

export function getPostUrl(postChainId: string | null | undefined, tokenId: string) {
  return postChainId ? `/post/${postChainId}/${tokenId}` : `/post/${tokenId}`;
}

export function getAvatarStyle(params: { authorAvatarUrl?: string; authorHue: number }) {
  const { authorAvatarUrl, authorHue } = params;
  return authorAvatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(authorAvatarUrl)})` }
    : { background: `hsl(${authorHue} 75% 55%)` };
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
