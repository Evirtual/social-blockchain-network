import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTopbarCenter } from "../../app/hooks/useTopbarCenter";
import { FeedTopbarControls } from "../../feed/components/FeedTopbarControls";
import { useSupportedNetworks } from "../../feed/hooks/useSupportedNetworks";
import { useWalletState } from "../../wallet/providers/useWalletState";
import { IconCheck } from "@shared/components/icons";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationsList } from "../components/NotificationsList";
import { readNotificationsLastSeen } from "../services/notificationReadState";
import { readShowBurnedNotifications, writeShowBurnedNotifications } from "../services/notificationViewPrefs";
import { isBurnedNotification } from "../lib/isBurnedNotification";

export function NotificationsHistoryPage() {
  const navigate = useNavigate();
  const wallet = useWalletState();
  const supportedNetworks = useSupportedNetworks();

  const [showBurned, setShowBurned] = useState(() => readShowBurnedNotifications());

  const [selectedNetworkChainIds, setSelectedNetworkChainIds] = useState<string[]>(() =>
    wallet.chainId ? [wallet.chainId] : []
  );

  useEffect(() => {
    if (!wallet.chainId) return;
    setSelectedNetworkChainIds([wallet.chainId]);
  }, [wallet.chainId]);

  const topbarCenter = useMemo(
    () => (
      <FeedTopbarControls
        title="Notifications"
        showSearch={false}
        searchQuery=""
        onSearchQueryChange={() => {
          // search disabled
        }}
        onSearchSubmit={() => {
          // search disabled
        }}
        walletAddress={wallet.walletAddress}
        chainId={wallet.chainId}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    ),
    [wallet.walletAddress, wallet.chainId, selectedNetworkChainIds, supportedNetworks]
  );

  useTopbarCenter(topbarCenter);

  const { items, loading, schemaMismatch, error, subgraphUrl } = useNotifications({
    open: true,
    walletAddress: wallet.walletAddress,
    chainId: wallet.chainId,
    first: 200
  });

  const visibleItems = useMemo(() => {
    const isRemoved = (kind: string) => kind === "POST_REMOVED_BY_ADMIN" || kind === "COMMENT_REMOVED";
    if (showBurned) {
      return items.filter((n) => isRemoved(n.kind) || isBurnedNotification(n, wallet.chainId));
    }
    return items.filter((n) => !isRemoved(n.kind) && !isBurnedNotification(n, wallet.chainId));
  }, [items, showBurned, wallet.chainId]);

  const [lastSeenTs, setLastSeenTs] = useState(() => readNotificationsLastSeen(wallet.chainId, wallet.walletAddress));

  useEffect(() => {
    setLastSeenTs(readNotificationsLastSeen(wallet.chainId, wallet.walletAddress));
  }, [wallet.chainId, wallet.walletAddress]);

  const body = useMemo(() => {

    if (!wallet.walletAddress) return <div className="muted">Connect your wallet to view notifications.</div>;

    if (!subgraphUrl) return <div className="muted">No subgraph is configured for this network.</div>;

    if (schemaMismatch) {
      return <div className="muted">Notifications are not available yet (subgraph schema mismatch).</div>;
    }

    if (error) {
      return (
        <>
          <div className="muted">Failed to load notifications: {error}</div>
        </>
      );
    }

    if (loading) {
      return (
        <>
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

    if (!visibleItems.length) {
      if (showBurned && items.length > 0) {
        return (
          <>
            <div className="muted">No removed/burned notifications.</div>
          </>
        );
      }

      if (!showBurned && items.length > 0) {
        return (
          <>
            <div className="muted">No notifications (removed/burned hidden). Enable “Removed posts” to view them.</div>
          </>
        );
      }
      return (
        <>
          <div className="muted">No notifications yet.</div>
        </>
      );
    }

    return (
      <>
        <NotificationsList
          items={visibleItems}
          lastSeenTs={lastSeenTs}
          chainId={wallet.chainId}
          onSelect={(_notification, to) => {
            navigate(to, { state: { chainId: wallet.chainId } });
          }}
        />
      </>
    );
  }, [
    wallet.walletAddress,
    wallet.chainId,
    subgraphUrl,
    schemaMismatch,
    error,
    loading,
    items,
    visibleItems,
    showBurned,
    lastSeenTs,
    navigate
  ]);

  return (
    <main className="home notificationsHistory">
      <section>
        <div className="pageHeader">
          <div className="pageHeaderTitle">Notification History</div>
          <div className="row" role="group" aria-label="Notification filters">
            <button
              type="button"
              className="pill notificationsShowBurnedToggle"
              aria-pressed={showBurned}
              onClick={() => {
                setShowBurned((prev) => {
                  const next = !prev;
                  writeShowBurnedNotifications(next);
                  return next;
                });
              }}
              title="Toggle burned notifications"
            >
              <span className="notificationsCheckbox" aria-hidden="true">
                {showBurned ? <IconCheck size={14} /> : null}
              </span>
              <span>Removed posts</span>
            </button>
          </div>
        </div>
        {body}
      </section>
    </main>
  );
}
