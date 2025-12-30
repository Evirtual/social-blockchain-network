import { Navigate, useParams } from "react-router-dom";
import { ProfilePageContainer } from "@features/profile";

export function ProfileRoute() {
  const params = useParams();
  const address = typeof params.address === "string" ? params.address : "";

  if (!address) {
    return <Navigate to="/" replace />;
  }
  return <ProfilePageContainer address={address} />;
}
