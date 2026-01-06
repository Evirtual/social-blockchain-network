import type { CSSProperties } from "react";
import { getAvatarStyle } from "@shared/lib/avatar";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { ChainLogo } from "@shared/components/ChainLogos";
import { getSupportedNetworks } from "@features/feed";
import type { NotificationItem } from "../types";
import { notificationActionText, notificationDetailText } from "../lib/notificationText";

type Props = {
  items: NotificationItem[];
  lastSeenTs: number;
  chainId: string | null;
  onSelect: (notification: NotificationItem, to: string) => void;
};

export function NotificationsList({ items, lastSeenTs, chainId, onSelect }: Props) {
  const supportedNetworks = getSupportedNetworks();
  const brandHueByChainId = new Map(supportedNetworks.map((network) => [network.chainId, network.brandHue]));

  return (
    <div className="list">
      {items.map((n) => {
        const actorId = String(n.actor?.id ?? "");
        const displayName = String(n.actor?.name ?? "").trim() || (actorId ? shortAddress(actorId) : "Unknown");
        const avatarStyle = getAvatarStyle({ avatarUrl: n.actor?.avatar ?? undefined, hue: stableHueFromSeed(actorId) });

        const commentId = typeof n.commentId === "string" && n.commentId.trim() ? n.commentId.trim() : "";
        const hash = commentId ? `#comment-${commentId}` : "";
        const to = `/post/${n.tokenId}${hash}`;
        const isUnread = typeof n.timestamp === "number" ? n.timestamp > lastSeenTs : false;
        const rowChainId = parseChainIdNumber(n.chainId ?? chainId);
        const brandHue = rowChainId == null ? undefined : brandHueByChainId.get(rowChainId);
        const brandStyle: CSSProperties & { ["--brand-hue"]?: string | number } = brandHue != null ? { ["--brand-hue"]: brandHue } : {};

        return (
          <button
            key={n.id}
            type="button"
            className={`listRow ${isUnread ? "isUnread" : ""}`}
            style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
            onClick={() => onSelect(n, to)}
          >
            <div className="listRowLeft">
              <div className="avatar tiny" style={avatarStyle} aria-hidden="true" />
              <div style={{ minWidth: 0 }}>
                <div className="profileName" title={displayName}>
                  {displayName} {notificationActionText(n.kind)}
                </div>
                <div className="profileMeta">{notificationDetailText(n)}</div>
              </div>
            </div>
            {rowChainId != null ? (
              <div className="listRowRight" aria-hidden="true">
                <span className="chainBrandMark" style={brandStyle}>
                  <ChainLogo chainId={rowChainId} size={18} />
                </span>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
