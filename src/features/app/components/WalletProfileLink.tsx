import { memo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getNetworkBadgeLabel, getNetworkBrandHue } from "@shared/lib/network";
import { shortAddress } from "@shared/lib/format";
import { ChainLogo } from "@shared/components/ChainLogos";

type BrandHueStyle = CSSProperties & { ["--brand-hue"]?: string | number };

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
            (() => {
              const brandStyle: BrandHueStyle = { ["--brand-hue"]: getNetworkBrandHue(chainId) };
              return (
                <span
                  className="chainBrandMark"
                  style={brandStyle}
                  aria-label={getNetworkBadgeLabel(chainId)}
                  title={getNetworkBadgeLabel(chainId)}
                >
                  <ChainLogo chainId={Number(chainId)} size={20} />
                </span>
              );
            })()
          ) : null}
        </>
      ) : (
        ""
      )}
    </Link>
  );
});
