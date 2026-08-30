import { ChainLogo } from "@shared/components/ChainLogos";
import type { CSSProperties } from "react";
import type { SupportedNetwork } from "../../feed/services/supportedNetworks";

type Props = {
  isDisconnected: boolean;
  isWrongNetwork: boolean;
  currentNetworkLabel: string;
  supportedNetworks: SupportedNetwork[];
  canSwitchNetwork: boolean;
  currentChainId: string | null;
  onDismiss: () => void;
  onRequestWalletNetworkSwitch: (targetChainId: number) => void | Promise<void>;
};

type BrandHueStyle = CSSProperties & { ["--brand-hue"]?: string | number };

export function HomeHeroSupportedNetworks(props: Props) {
  return (
    <section className="card hero supportedNetworksHero">
      <button
        className="iconButton ghost heroClose"
        type="button"
        aria-label="Dismiss supported networks"
        onClick={props.onDismiss}
      >
        ×
      </button>

      <div className="heroTitle">Supported networks</div>
      <div className="heroSub muted">
        {props.isDisconnected ? (
          <>
            Connect your wallet on a supported testnet to
            <br />
            post, react, and tip.
          </>
        ) : props.isWrongNetwork ? (
          <>
            Wrong network{props.currentNetworkLabel ? `: ${props.currentNetworkLabel}` : ""}.
            <br />
            Select a supported network to switch or add it to your wallet.
          </>
        ) : (
          "Use one of these testnets to post, react, and tip."
        )}
      </div>

      <div className="heroBullets" role="list">
        {props.supportedNetworks.map((n) => {
          const brandStyle: BrandHueStyle = { ["--brand-hue"]: n.brandHue };
          return (
            <button
              key={n.chainId}
              className={`pill pillButton ${props.currentChainId === String(n.chainId) ? "isCurrentNetwork" : ""}`}
              type="button"
              role="listitem"
              aria-label={n.displayName}
              aria-current={props.currentChainId === String(n.chainId) ? "true" : undefined}
              onClick={() => {
                void props.onRequestWalletNetworkSwitch(n.chainId);
              }}
              disabled={!props.canSwitchNetwork}
              title={!props.canSwitchNetwork ? "Connect a wallet to switch networks" : "Switch or add this network"}
            >
              <span className="pillIcon" aria-hidden="true">
                <span className="chainBrandMark" style={brandStyle}>
                  <ChainLogo chainId={n.chainId} size={20} />
                </span>
              </span>
              {n.displayName}
            </button>
          );
        })}
      </div>
    </section>
  );
}
