import { Navigate, useLocation, useParams } from "react-router-dom";
import { ProfilePageContainer } from "@features/profile/pages/ProfilePageContainer";
import { useWalletState } from "@features/wallet/providers/useWalletState";

export function ProfileRoute() {
  const params = useParams();
  const location = useLocation();
  const walletChainId = useWalletState().chainId;
  const address = typeof params.address === "string" ? params.address : "";

  const stateChainId = (location.state as { chainId?: string | null } | null)?.chainId ?? null;
  const paramChainId = (params.chainId as string | undefined) ?? null;

  // If we are on a chain-specific profile URL and the wallet network changes,
  // keep the URL's chainId in sync.
  if (address && paramChainId && walletChainId && paramChainId !== walletChainId) {
    return (
      <Navigate
        to={{ pathname: `/profile/${walletChainId}/${address}`, search: location.search, hash: location.hash }}
        replace
        state={location.state}
      />
    );
  }

  // If we navigated internally with chainId in state, prefer the canonical URL.
  if (address && !paramChainId && stateChainId) {
    return (
      <Navigate
        to={{ pathname: `/profile/${stateChainId}/${address}`, search: location.search, hash: location.hash }}
        replace
        state={location.state}
      />
    );
  }

  if (!address) {
    return <Navigate to="/" replace />;
  }
  return <ProfilePageContainer address={address} />;
}
