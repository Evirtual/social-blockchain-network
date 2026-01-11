import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTopbarCenter } from "@features/app";
import { FeedTopbarControls, useSupportedNetworks } from "@features/feed";
import { useWalletState } from "@features/wallet";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationsList } from "../components/NotificationsList";
import { readNotificationsLastSeen } from "../services/notificationReadState";

export function NotificationsHistoryPage() {
  const navigate = useNavigate();
  const wallet = useWalletState();
  const supportedNetworks = useSupportedNetworks();

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
      return <div className="muted">Failed to load notifications: {error}</div>;
    }

    if (loading) {
      return (
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
      );
    }

    if (!items.length) {
      return <div className="muted">No notifications yet.</div>;
    }

    return (
      <NotificationsList
        items={items}
        lastSeenTs={lastSeenTs}
        chainId={wallet.chainId}
        onSelect={(_notification, to) => {
          navigate(to, { state: { chainId: wallet.chainId } });
        }}
      />
    );
  }, [
    wallet.walletAddress,
    wallet.chainId,
    subgraphUrl,
    schemaMismatch,
    error,
    loading,
    items,
    lastSeenTs,
    navigate
  ]);

  return (
    <main className="home notificationsHistory">
      <section className="card">
        <div className="pageHeader">
          <div className="pageHeaderTitle">Notification History</div>
        </div>
        {body}
      </section>
    </main>
  );
}
