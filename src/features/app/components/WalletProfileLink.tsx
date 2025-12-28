import { memo } from "react";
import { Link } from "react-router-dom";
import { getNetworkBadgeLabel } from "@shared/lib/chain";
import { shortAddress } from "@shared/lib/format";

export const WalletProfileLink = memo(function WalletProfileLink(props: {
  profileLink: string | null;
  walletAddress: string | null;
  chainId: string | null;
}) {
  const { profileLink, walletAddress, chainId } = props;
  if (!profileLink) return null;

  return (
    <Link className="btn secondary" to={profileLink}>
      {walletAddress ? (
        <>
          {shortAddress(walletAddress)}
          {typeof chainId === "string" && chainId ? (
            <span className="badge">{getNetworkBadgeLabel(chainId)}</span>
          ) : null}
        </>
      ) : (
        ""
      )}
    </Link>
  );
});
