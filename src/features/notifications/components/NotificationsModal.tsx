import { useEffect, useMemo, useState } from "react";
import { Modal } from "@shared/components/Modal";
import { getAvatarStyle } from "@shared/lib/avatar";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { useNotifications } from "../hooks/useNotifications";
import type { NotificationItem } from "../types";
import { useNavigate } from "react-router-dom";
import {
  maxNotificationTimestamp,
  readNotificationsLastSeen,
  writeNotificationsLastSeen
} from "../services/notificationReadState";

function actionText(kind: string): string {
  switch (kind) {
    case "POST_LIKED":
      return "liked your post";
    case "POST_SAVED":
      return "saved your post";
    case "POST_COMMENTED":
      return "commented on your post";
    case "COMMENT_LIKED":
      return "liked your comment";
    case "COMMENT_SAVED":
      return "saved your comment";
    case "COMMENT_REPLIED":
      return "replied to your comment";
    default:
      return "interacted with you";
  }
}

function detailText(n: NotificationItem): string {
  const base = `Post #${n.tokenId}`;
  const cid = typeof n.commentId === "string" && n.commentId.trim() ? n.commentId.trim() : "";
  if (!cid) return base;

  if (n.kind === "COMMENT_REPLIED") return `${base} · Reply to comment #${cid}`;
  if (n.kind === "COMMENT_LIKED" || n.kind === "COMMENT_SAVED") return `${base} · Comment #${cid}`;
  if (n.kind === "POST_COMMENTED") return `${base} · Comment #${cid}`;
  return base;
}

export type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
  walletAddress: string | null;
  chainId: string | null;
};

export function NotificationsModal(props: NotificationsModalProps) {
  const navigate = useNavigate();
  const { items, loading, schemaMismatch, error, subgraphUrl } = useNotifications({
    open: props.open,
    walletAddress: props.walletAddress,
    chainId: props.chainId,
    first: 50
  });

  const [lastSeenTs, setLastSeenTs] = useState(() => readNotificationsLastSeen(props.chainId, props.walletAddress));

  useEffect(() => {
    if (!props.open) return;
    setLastSeenTs(readNotificationsLastSeen(props.chainId, props.walletAddress));
  }, [props.open, props.chainId, props.walletAddress]);

  const markAllSeen = () => {
    const next = Math.max(lastSeenTs, maxNotificationTimestamp(items));
    writeNotificationsLastSeen(props.chainId, props.walletAddress, next);
    setLastSeenTs(next);
  };

  const handleClose = () => {
    markAllSeen();
    props.onClose();
  };

  const body = useMemo(() => {
    if (!props.walletAddress) return <div className="muted">Connect your wallet to view notifications.</div>;

    if (!subgraphUrl) return <div className="muted">No subgraph is configured for this network.</div>;

    if (schemaMismatch) {
      return <div className="muted">Notifications are not available yet (subgraph schema mismatch).</div>;
    }

    if (error) {
      return <div className="muted">Failed to load notifications: {error}</div>;
    }

    if (loading) {
      return (
        <div className="list" aria-busy="true">
          <div className="listRow" aria-hidden="true">
            <span className="listRowLeft">
              <div className="avatar tiny skeleton" />
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span className="skeletonLine" style={{ width: "13rem", height: "1rem" }} />
                <span className="skeletonLine" style={{ width: "10rem", height: "0.9rem" }} />
              </span>
            </span>
          </div>
        </div>
      );
    }

    if (!items.length) {
      return <div className="muted">No notifications yet.</div>;
    }

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

          return (
            <button
              key={n.id}
              type="button"
              className={`listRow ${isUnread ? "isUnread" : ""}`}
              style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => {
                markAllSeen();
                navigate(to, { state: { chainId: props.chainId } });
                props.onClose();
              }}
            >
              <div className="listRowLeft">
                <div className="avatar tiny" style={avatarStyle} aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div className="profileName" title={displayName}>
                    {displayName} {actionText(n.kind)}
                  </div>
                  <div className="profileMeta">{detailText(n)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }, [props.walletAddress, props.chainId, props.onClose, subgraphUrl, schemaMismatch, error, loading, items, navigate, lastSeenTs]);

  return (
    <Modal open={props.open} title="Notifications" onClose={handleClose}>
      {body}
    </Modal>
  );
}
