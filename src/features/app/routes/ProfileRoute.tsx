import { Navigate, useLocation, useParams } from "react-router-dom";
import { ProfilePageContainer } from "@features/profile";

export function ProfileRoute() {
  const params = useParams();
  const location = useLocation();
  const address = typeof params.address === "string" ? params.address : "";

  const stateChainId = (location.state as { chainId?: string | null } | null)?.chainId ?? null;
  const paramChainId = (params.chainId as string | undefined) ?? null;

  // If we navigated internally with chainId in state, prefer the canonical URL.
  if (address && !paramChainId && stateChainId) {
    return <Navigate to={`/profile/${stateChainId}/${address}`} replace state={location.state} />;
  }

  if (!address) {
    return <Navigate to="/" replace />;
  }
  return <ProfilePageContainer address={address} />;
}
