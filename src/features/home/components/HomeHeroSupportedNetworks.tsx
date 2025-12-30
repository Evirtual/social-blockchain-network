import { ChainLogo } from "../../app";
import type { SupportedNetwork } from "../services/supportedNetworks";

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
          "Your wallet is connected, but this app isn’t configured for the current network."
        ) : (
          "Use one of these testnets to post, react, and tip."
        )}
      </div>
      {props.isWrongNetwork && props.currentNetworkLabel ? (
        <div className="pill">Current: {props.currentNetworkLabel}</div>
      ) : null}

      <div className="heroBullets" role="list">
        {props.supportedNetworks.map((n) => (
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
            title={!props.canSwitchNetwork ? "Connect a wallet to switch networks" : undefined}
          >
              <span className="pillIcon" aria-hidden="true">
                <span className="chainBrandMark" style={{ ["--brand-hue" as any]: n.brandHue }}>
                  <ChainLogo chainId={n.chainId} size={20} />
                </span>
              </span>
              {n.displayName}
          </button>
        ))}
      </div>
    </section>
  );
}
