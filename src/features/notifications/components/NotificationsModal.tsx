import { useEffect, useMemo, useState } from "react";
import { Modal } from "@shared/components/Modal";
import { useNotifications } from "../hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import {
  maxNotificationTimestamp,
  readNotificationsLastSeen,
  writeNotificationsLastSeen
} from "../services/notificationReadState";
import { NotificationsList } from "./NotificationsList";
import { isBurnedNotification } from "../lib/isBurnedNotification";

export type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
  walletAddress: string | null;
  chainId: string | null;
};

export function NotificationsModal(props: NotificationsModalProps) {
  const navigate = useNavigate();
  const { items, loading, schemaMismatch, amountWeiUnsupported, supportBpsUnsupported, error, subgraphUrl } = useNotifications({
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

  const unreadItems = useMemo(
    () => items.filter((n) => (typeof n.timestamp === "number" ? n.timestamp > lastSeenTs : false)),
    [items, lastSeenTs]
  );

  const visibleUnreadItems = useMemo(() => {
    const isRemoved = (kind: string) => kind === "POST_REMOVED_BY_ADMIN" || kind === "COMMENT_REMOVED";
    return unreadItems.filter((n) => !isRemoved(n.kind) && !isBurnedNotification(n, props.chainId));
  }, [unreadItems, props.chainId]);

  const body = useMemo(() => {
    const compatNote = amountWeiUnsupported || supportBpsUnsupported ? (
      <section className="card hero isCompact notificationsCompatHero">
        <div className="heroSub muted">You're using an older subgraph version. Some notifications may be incomplete.</div>
        <div className="heroBullets" role="list">
          {amountWeiUnsupported ? (
            <div className="pill" role="listitem">
              Tip amounts
            </div>
          ) : null}
          {supportBpsUnsupported ? (
            <div className="pill" role="listitem">
              Tip/fee percentages
            </div>
          ) : null}
          <div className="pill" role="listitem">
            Newer notification types
          </div>
        </div>
      </section>
    ) : null;

    if (!props.walletAddress) return <div className="muted">Connect your wallet to view notifications.</div>;

    if (!subgraphUrl) return <div className="muted">No subgraph is configured for this network.</div>;

    if (schemaMismatch) {
      return <div className="muted">Notifications are not available yet (subgraph schema mismatch).</div>;
    }

    if (error) {
      return (
        <>
          {compatNote}
          <div className="muted">Failed to load notifications: {error}</div>
        </>
      );
    }

    if (loading) {
      return (
        <>
          {compatNote}
          <div className="list" aria-busy="true">
            <div className="listRow" aria-hidden="true">
              <span className="listRowLeft">
                <div className="avatar skeleton" />
                <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span className="skeletonLine" style={{ width: "13rem", height: "1rem" }} />
                  <span className="skeletonLine" style={{ width: "10rem", height: "0.9rem" }} />
                </span>
              </span>
            </div>
          </div>
        </>
      );
    }

    if (!items.length) {
      return (
        <>
          {compatNote}
          <div className="muted">No notifications yet.</div>
        </>
      );
    }

    if (!visibleUnreadItems.length) {
      return (
        <>
          {compatNote}
          <div className="muted">You're all caught up.</div>
        </>
      );
    }

    return (
      <>
        {compatNote}
        <NotificationsList
          items={visibleUnreadItems}
          lastSeenTs={lastSeenTs}
          chainId={props.chainId}
          onSelect={(_notification, to) => {
            markAllSeen();
            navigate(to, { state: { chainId: props.chainId } });
            props.onClose();
          }}
        />
      </>
    );
  }, [
    props.walletAddress,
    props.chainId,
    props.onClose,
    subgraphUrl,
    schemaMismatch,
    amountWeiUnsupported,
    supportBpsUnsupported,
    error,
    loading,
    items,
    unreadItems,
    visibleUnreadItems,
    navigate,
    lastSeenTs
  ]);

  return (
    <Modal open={props.open} title="Latest notification" onClose={handleClose}>
      {body}
      <div className="rowActions notificationsModalFooter">
        <button
          className="ghost"
          type="button"
          onClick={() => {
            markAllSeen();
            navigate("/notifications");
            props.onClose();
          }}
        >
          Notification history
        </button>
      </div>
    </Modal>
  );
}
