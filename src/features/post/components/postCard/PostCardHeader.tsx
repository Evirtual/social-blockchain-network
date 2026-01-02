import { Link } from "react-router-dom";
import type { CSSProperties, MouseEvent } from "react";
import { IconEdit, IconFlame, IconFlag } from "@shared/components/icons";
import { ChainLogo } from "@shared/components/ChainLogos";

type Props = {
  author?: string | null;
  authorLabel: string;
  avatarStyle: CSSProperties;
  isMine: boolean;
  canModerate?: boolean;
  isEditing: boolean;
  requiresNetworkSwitch: boolean;
  postNetworkLabel: string;
  isCurrentNetworkPost: boolean;
  postNetworkTitle: string;
  postNetworkHue: number;
  postNetworkChainIdNum: number;
  explorer: string | null;
  hasMintTxHash: boolean;
  onCopyMintTx: (event: MouseEvent<HTMLAnchorElement>) => void;
  onOpenReport: () => void;
  onStartEdit: () => void;
  onBurn: () => void;
};

export function PostCardHeader(props: Props) {
  const brandStyle: CSSProperties & { ["--brand-hue"]?: string | number } = { ["--brand-hue"]: props.postNetworkHue };

  return (
    <div className="postHead">
      <div className="avatar small" style={props.avatarStyle} />
      <div className="postHeadMain">
        <div className="postHeadTop">
          <div className="postAuthor">
            {props.author ? <Link to={`/profile/${props.author}`}>{props.authorLabel}</Link> : props.authorLabel}
            {props.isMine ? <span className="badge">You</span> : null}
          </div>
          <div className="postTokenArea">
            {props.postNetworkLabel ? (
              props.hasMintTxHash ? (
                <a
                  className={`postNetworkMarkLink ${props.isCurrentNetworkPost ? "isCurrentNetwork" : ""}`}
                  href={props.explorer ?? "#"}
                  target={props.explorer ? "_blank" : undefined}
                  rel={props.explorer ? "noreferrer" : undefined}
                  aria-label={props.postNetworkTitle ? `Network: ${props.postNetworkTitle}` : "Network"}
                  title={props.postNetworkTitle || (props.explorer ? "View mint transaction" : "Copy mint transaction hash")}
                  onClick={props.onCopyMintTx}
                >
                  <span className="chainBrandMark" style={brandStyle} aria-hidden="true">
                    <ChainLogo chainId={props.postNetworkChainIdNum} size={24} />
                  </span>
                </a>
              ) : (
                <span
                  className={`postNetworkMarkLink ${props.isCurrentNetworkPost ? "isCurrentNetwork" : ""}`}
                  aria-label={props.postNetworkTitle ? `Network: ${props.postNetworkTitle}` : "Network"}
                  title={props.postNetworkTitle}
                >
                  <span className="chainBrandMark" style={brandStyle} aria-hidden="true">
                    <ChainLogo chainId={props.postNetworkChainIdNum} size={24} />
                  </span>
                </span>
              )
            ) : null}
            {!props.isEditing ? (
              <span className="postTokenActions">
                <button
                  className={`ghost iconButton${props.requiresNetworkSwitch ? " notAllowed" : ""}`}
                  type="button"
                  onClick={props.onOpenReport}
                  aria-label="Report post"
                  title="Report"
                  disabled={props.requiresNetworkSwitch}
                >
                  <IconFlag size={16} />
                </button>
              </span>
            ) : null}
            {(props.isMine || props.canModerate) && !props.isEditing ? (
              <span className="postTokenActions">
                <button
                  className={`ghost iconButton${props.requiresNetworkSwitch ? " notAllowed" : ""}`}
                  type="button"
                  onClick={props.onStartEdit}
                  aria-label="Edit post"
                  title="Edit"
                  disabled={props.requiresNetworkSwitch}
                >
                  <IconEdit size={16} />
                </button>
                <button
                  className={`danger iconButton${props.requiresNetworkSwitch ? " notAllowed" : ""}`}
                  type="button"
                  onClick={props.onBurn}
                  aria-label="Burn post"
                  title="Burn"
                  disabled={props.requiresNetworkSwitch}
                >
                  <IconFlame size={16} />
                </button>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
