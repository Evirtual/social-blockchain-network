import { memo } from "react";
import { Link } from "react-router-dom";
import { shortAddress } from "@shared/lib/formatters";

export const WalletProfileLink = memo(function WalletProfileLink(props: {
  profileLink: string | null;
  walletAddress: string | null;
}) {
  const { profileLink, walletAddress } = props;
  if (!profileLink) return null;

  return (
    <Link className="btn secondary" to={profileLink}>
      {walletAddress ? (
        <>
          {shortAddress(walletAddress)}
        </>
      ) : (
        ""
      )}
    </Link>
  );
});
