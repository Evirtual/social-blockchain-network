import { AppProviders } from "./features/app";
import { Navigate, Route, Routes } from "react-router-dom";
import { ComposerCard, Topbar, TopbarOverflowProvider, TopbarSlotsProvider, TxToaster, WalletProfileLink } from "./features/app";
import { Modal } from "@shared/components/Modal";
import { HomeRoute, NotificationsRoute, PostRoute, ProfileRoute } from "./features/app";
import { useComposeNudge, useConnectNudge, useConnectWallet } from "./features/app";
import { ScrollToTop } from "./features/app/components/ScrollToTop";
import { useStatusActions } from "./features/status";
import { useTheme } from "./features/theme";
import { useComposer } from "./features/composer";
import { useContractActions } from "./features/contract/providers/useContractActions";
import { useProfileState } from "./features/profile";
import { isSupportedNetworkChainId, useFeedActions } from "./features/feed";
import { useWalletActions, useWalletState } from "./features/wallet";
import { ipfsToHttp } from "./features/ipfs";
import { NotificationsModal } from "./features/notifications";
import { useState, type ReactNode } from "react";
import { useNotificationsBadge } from "./features/notifications/hooks/useNotificationsBadge";

function AppInner() {
  const [topbarCenter, setTopbarCenter] = useState<ReactNode | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const theme = useTheme();
  const walletState = useWalletState();
  const walletActions = useWalletActions();
  const contract = useContractActions();
  const feed = useFeedActions();
  const profile = useProfileState();
  const composer = useComposer();
  const { setStatus } = useStatusActions();

  const { connectNudge, triggerConnectNudge } = useConnectNudge();
  const { composeNudge } = useComposeNudge();
  const connectWallet = useConnectWallet({
    wallet: walletActions,
    contract,
    feed,
    setStatus,
    triggerConnectNudge
  });

  const composerAvatarStyle = profile.profileDraftAvatarDataUrl?.startsWith("data:image/")
    ? { backgroundImage: `url(${profile.profileDraftAvatarDataUrl})` }
    : profile.profileAvatarUrl?.trim()
      ? { backgroundImage: `url(${ipfsToHttp(profile.profileAvatarUrl)})` }
      : { background: `hsl(${profile.selfAvatarHue} 75% 55%)` };

  const { hasUnread } = useNotificationsBadge({
    walletAddress: walletState.walletAddress,
    chainId: walletState.chainId,
    first: 30
  });
  const canCreatePost = Boolean(walletState.walletAddress && isSupportedNetworkChainId(walletState.chainId));

  return (
    <TopbarOverflowProvider>
      <TopbarSlotsProvider
        value={{
          center: topbarCenter,
          setCenter: setTopbarCenter
        }}
      >
        <div className="app">
          <ScrollToTop />
          <Topbar
            theme={theme.theme}
            connectNudge={connectNudge}
            composeNudge={composeNudge}
            walletAddress={walletState.walletAddress}
            canCreatePost={canCreatePost}
            onToggleTheme={theme.toggleTheme}
            onConnectWallet={connectWallet}
            onOpenComposer={composer.openComposer}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            hasUnreadNotifications={hasUnread}
            centerSlot={topbarCenter}
            rightSlot={
              <WalletProfileLink
                profileLink={profile.profileLink}
                walletAddress={walletState.walletAddress}
                chainId={walletState.chainId}
              />
            }
          />

      <NotificationsModal
        open={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        walletAddress={walletState.walletAddress}
        chainId={walletState.chainId}
      />

      <Modal
        open={composer.isComposerOpen}
        title="Create a post"
        headerLeading={<div className="avatar small" style={composerAvatarStyle} />}
        onClose={composer.closeComposer}
      >
        <ComposerCard
          draft={composer.draft}
          isImageLoading={composer.isImageLoading}
          isPosting={composer.isPosting}
          postDisabledReason={composer.postDisabledReason}
          onDraftFieldChange={composer.handleDraftChange}
          onSelectFile={composer.onSelectComposerFile}
          onClearImage={composer.onComposerClearImage}
          onPost={composer.mintPost}
        />
      </Modal>

      <Modal open={composer.approvalRequired} title="Request posting approval" onClose={composer.dismissApproval}>
        <div className="composer">
          <div className="muted">Posting is in closed beta. Request approval, then wait for an admin to approve your wallet.</div>
          <div className="rowActions">
            <button className="secondary" type="button" onClick={composer.dismissApproval}>
              Close
            </button>
            <button
              className="primary buttonWithSpinner"
              type="button"
              onClick={composer.requestApproval}
              disabled={composer.isApprovalLoading || composer.approvalRequested}
            >
              {composer.isApprovalLoading ? <span className="spinner" aria-hidden="true" /> : null}
              {composer.approvalRequested ? "Requested" : "Request approval"}
            </button>
          </div>
        </div>
      </Modal>

      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/notifications" element={<NotificationsRoute />} />
        <Route path="/post/:chainId/:tokenId" element={<PostRoute />} />
        <Route path="/post/:tokenId" element={<PostRoute />} />
        <Route path="/profile/:chainId/:address" element={<ProfileRoute />} />
        <Route path="/profile/:address" element={<ProfileRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

        <TxToaster />
        </div>
      </TopbarSlotsProvider>
    </TopbarOverflowProvider>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppInner />
    </AppProviders>
  );
}
