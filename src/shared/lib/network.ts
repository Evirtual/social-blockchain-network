import { getNetworkBadgeLabel, getNetworkBrandHue, getExplorerTxUrl, getNativeSymbol } from "./chain";
import { parseChainIdNumber } from "./chainId";

export { getNetworkBadgeLabel, getNetworkBrandHue, getExplorerTxUrl, getNativeSymbol, parseChainIdNumber };

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
