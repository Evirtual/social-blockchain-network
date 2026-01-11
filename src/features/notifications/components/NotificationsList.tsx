import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getAvatarStyle } from "@shared/lib/avatar";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { ChainLogo } from "@shared/components/ChainLogos";
import {
  IconBookmark,
  IconCheck,
  IconCoin,
  IconEdit,
  IconEye,
  IconFlag,
  IconHeart,
  IconMessage,
  IconQuestion,
  IconRepeat,
  IconTrash,
  IconX
} from "@shared/components/icons";
import { getSupportedNetworks } from "@features/feed";
import type { NotificationItem } from "../types";
import { notificationActionText, notificationDetailText } from "../lib/notificationText";

type Props = {
  items: NotificationItem[];
  lastSeenTs: number;
  chainId: string | null;
  onSelect: (notification: NotificationItem, to: string) => void;
};

function getKindClass(kind: string): string {
  if (kind === "FOLLOWED" || kind === "UNFOLLOWED") return "isFollow";
  if (kind.includes("LIKED") || kind.includes("UNLIKED")) return "isLike";
  if (kind.includes("SAVED") || kind.includes("UNSAVED")) return "isSave";
  if (kind.includes("COMMENT")) return "isComment";
  if (kind.includes("TIPPED")) return "isTip";
  if (kind.includes("APPROVAL") || kind.includes("APPROVED") || kind.includes("DISAPPROVED")) return "isApproval";
  if (kind.includes("REPORTED")) return "isReport";
  if (kind.includes("REMOVED")) return "isRemove";
  if (kind.includes("PROFILE") || kind.includes("ADMIN") || kind.includes("FROZEN") || kind.includes("UPDATED")) return "isAdmin";
  return "isDefault";
}

function getKindIcon(kind: string): { icon: JSX.Element; label: string } {
  switch (kind) {
    case "FOLLOWED":
      return { icon: <IconRepeat size={16} />, label: "Followed" };
    case "UNFOLLOWED":
      return { icon: <IconRepeat size={16} />, label: "Unfollowed" };
    case "POST_LIKED":
    case "COMMENT_LIKED":
      return { icon: <IconHeart size={16} />, label: "Liked" };
    case "POST_UNLIKED":
    case "COMMENT_UNLIKED":
      return { icon: <IconHeart size={16} />, label: "Unliked" };
    case "POST_SAVED":
    case "COMMENT_SAVED":
      return { icon: <IconBookmark size={16} />, label: "Saved" };
    case "POST_UNSAVED":
    case "COMMENT_UNSAVED":
      return { icon: <IconBookmark size={16} />, label: "Unsaved" };
    case "POST_COMMENTED":
    case "COMMENT_REPLIED":
    case "COMMENT_REMOVED":
      return { icon: <IconMessage size={16} />, label: "Comment" };
    case "POST_TIPPED":
    case "COMMENT_TIPPED":
      return { icon: <IconCoin size={16} />, label: "Tipped" };
    case "POST_UPDATED_BY_ADMIN":
      return { icon: <IconEdit size={16} />, label: "Updated by admin" };
    case "POST_FROZEN":
      return { icon: <IconEye size={16} />, label: "Post frozen" };
    case "POST_REMOVED_BY_ADMIN":
      return { icon: <IconTrash size={16} />, label: "Post removed" };
    case "POST_REPORTED":
    case "COMMENT_REPORTED":
      return { icon: <IconFlag size={16} />, label: "Reported" };
    case "POSTER_APPROVAL_REQUESTED":
      return { icon: <IconQuestion size={16} />, label: "Approval requested" };
    case "POSTER_APPROVED":
      return { icon: <IconCheck size={16} />, label: "Approved" };
    case "POSTER_DISAPPROVED":
      return { icon: <IconX size={16} />, label: "Disapproved" };
    case "PROFILE_MODERATED":
    case "PROFILE_CLEARED_BY_ADMIN":
      return { icon: <IconEdit size={16} />, label: "Profile action" };
    default:
      return { icon: <IconMessage size={16} />, label: "Notification" };
  }
}

function buildMetaPills(notification: NotificationItem): Array<{ label: string; icon?: JSX.Element }> {
  const pills: Array<{ label: string; icon?: JSX.Element }> = [];
  if (
    notification.kind === "POSTER_APPROVAL_REQUESTED" ||
    notification.kind === "POSTER_APPROVED" ||
    notification.kind === "POSTER_DISAPPROVED" ||
    notification.kind === "PROFILE_MODERATED" ||
    notification.kind === "PROFILE_CLEARED_BY_ADMIN"
  ) {
    return pills;
  }
  const tokenId = String(notification.tokenId ?? "").trim();
  const commentId = typeof notification.commentId === "string" ? notification.commentId.trim() : "";
  if (tokenId && tokenId !== "0") {
    pills.push({ label: `Post #${tokenId}` });
  }
  if (commentId) {
    pills.push({ label: `Comment #${commentId}`, icon: <IconMessage size={14} /> });
  }
  return pills;
}

export function NotificationsList({ items, lastSeenTs, chainId, onSelect }: Props) {
  const supportedNetworks = getSupportedNetworks();
  const brandHueByChainId = new Map(supportedNetworks.map((network) => [network.chainId, network.brandHue]));

  return (
    <div className="list">
      {items.map((n) => {
        const actorId = String(n.actor?.id ?? "");
        const isSelfApproval = n.kind === "POSTER_APPROVED";
        const displayName = isSelfApproval
          ? "You"
          : String(n.actor?.name ?? "").trim() || (actorId ? shortAddress(actorId) : "Unknown");
        const avatarStyle = getAvatarStyle({
          avatarUrl: isSelfApproval ? undefined : n.actor?.avatar ?? undefined,
          hue: stableHueFromSeed(isSelfApproval ? "" : actorId)
        });

        const commentId = typeof n.commentId === "string" && n.commentId.trim() ? n.commentId.trim() : "";
        const hash = commentId ? `#comment-${commentId}` : "";
        const to = `/post/${n.tokenId}${hash}`;
        const isUnread = typeof n.timestamp === "number" ? n.timestamp > lastSeenTs : false;
        const rowChainId = parseChainIdNumber(n.chainId ?? chainId);
        const brandHue = rowChainId == null ? undefined : brandHueByChainId.get(rowChainId);
        const brandStyle: CSSProperties & { ["--brand-hue"]?: string | number } = brandHue != null ? { ["--brand-hue"]: brandHue } : {};
        const kindClass = getKindClass(n.kind);
        const kindIcon = getKindIcon(n.kind);
        const metaPills = buildMetaPills(n);
        const detailText = notificationDetailText(n);
        const profileLink = !isSelfApproval && actorId ? `/profile/${actorId}` : "";
        const actionText = isSelfApproval ? "were approved to post" : notificationActionText(n.kind);

        return (
          <button
            key={n.id}
            type="button"
            className={`listRow notificationRow ${isUnread ? "isUnread" : ""}`}
            style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
            onClick={() => onSelect(n, to)}
          >
            <div className="listRowLeft">
              <div className="avatar tiny" style={avatarStyle} aria-hidden="true" />
              <div className={`notificationActionIcon ${kindClass}`} aria-hidden="true">
                {kindIcon.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="profileName" title={displayName}>
                  {profileLink ? (
                    <Link
                      className="notificationActorLink"
                      to={profileLink}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {displayName}
                    </Link>
                  ) : (
                    displayName
                  )}{" "}
                  {actionText}
                </div>
                <div className="profileMeta notificationMeta">
                  {metaPills.length > 0 ? (
                    <div className="notificationPills">
                      {metaPills.map((pill) => (
                        <span key={pill.label} className="pill notificationPill">
                          {pill.icon ? <span className="pillIcon">{pill.icon}</span> : null}
                          {pill.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {detailText ? <div className="notificationDetailText">{detailText}</div> : null}
                </div>
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
