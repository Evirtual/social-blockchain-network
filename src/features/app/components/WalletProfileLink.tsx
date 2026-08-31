import { memo } from "react";
import { Link } from "react-router-dom";
import { getAvatarStyle } from "@shared/lib/avatar";
import { getNetworkBadgeLabel, getNetworkBrandHue } from "@shared/lib/network";
import { ChainLogo } from "@shared/components/ChainLogos";
import type { CSSProperties } from "react";

type BrandHueStyle = CSSProperties & { ["--brand-hue"]?: string | number };

export const WalletProfileLink = memo(function WalletProfileLink(props: {
  profileLink: string | null;
  walletAddress: string | null;
  chainId: string | null;
  /** Already falls back to the short address when no name is set. */
  displayName: string;
  avatarUrl?: string;
  avatarHue: number;
}) {
  const { profileLink, walletAddress, chainId, displayName, avatarUrl, avatarHue } = props;
  if (!profileLink) return null;

  const showChain = typeof chainId === "string" && chainId.trim();
  const brandStyle: BrandHueStyle = showChain ? { ["--brand-hue"]: getNetworkBrandHue(chainId) } : {};

  return (
    <Link className="btn secondary walletProfileLink" to={profileLink}>
      {walletAddress ? (
        <>
          {/* The avatar shows either the uploaded image or the address's own hue,
              so the pill identifies the account whether a profile is set or not. */}
          <span className="avatar tiny walletProfileLinkAvatar" style={getAvatarStyle({ avatarUrl, hue: avatarHue })} />
          <span className="walletProfileLinkName">{displayName}</span>
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
