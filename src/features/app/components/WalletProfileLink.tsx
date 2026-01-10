import { memo } from "react";
import { Link } from "react-router-dom";
import { shortAddress } from "@shared/lib/formatters";
import { getNetworkBadgeLabel, getNetworkBrandHue } from "@shared/lib/network";
import { ChainLogo } from "@shared/components/ChainLogos";
import type { CSSProperties } from "react";

type BrandHueStyle = CSSProperties & { ["--brand-hue"]?: string | number };

export const WalletProfileLink = memo(function WalletProfileLink(props: {
  profileLink: string | null;
  walletAddress: string | null;
  chainId: string | null;
}) {
  const { profileLink, walletAddress, chainId } = props;
  if (!profileLink) return null;

  const showChain = typeof chainId === "string" && chainId.trim();
  const brandStyle: BrandHueStyle = showChain ? { ["--brand-hue"]: getNetworkBrandHue(chainId) } : {};

  return (
    <Link className="btn secondary" to={profileLink}>
      {walletAddress ? (
        <>
          {shortAddress(walletAddress)}
          {showChain ? (
            <span
              className="walletProfileLinkChain chainBrandMark"
              style={brandStyle}
              aria-label={getNetworkBadgeLabel(chainId)}
              title={getNetworkBadgeLabel(chainId)}
            >
              <ChainLogo chainId={Number(chainId)} size={18} />
            </span>
          ) : null}
        </>
      ) : (
        ""
      )}
    </Link>
  );
});
