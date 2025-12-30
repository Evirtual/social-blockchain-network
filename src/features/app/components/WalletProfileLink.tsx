import { memo } from "react";
import { Link } from "react-router-dom";
import { getNetworkBadgeLabel, getNetworkBrandHue } from "@shared/lib/network";
import { shortAddress } from "@shared/lib/format";
import { ChainLogo } from "./ChainLogos";

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
            <span
              className="chainBrandMark"
              style={{ ["--brand-hue" as any]: getNetworkBrandHue(chainId) }}
              aria-label={getNetworkBadgeLabel(chainId)}
              title={getNetworkBadgeLabel(chainId)}
            >
              <ChainLogo chainId={Number(chainId)} size={20} />
            </span>
          ) : null}
        </>
      ) : (
        ""
      )}
    </Link>
  );
});
