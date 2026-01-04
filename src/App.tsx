import { AppProviders } from "./features/app";
import { Navigate, Route, Routes } from "react-router-dom";
import { ComposerCard, Topbar, TxToaster, WalletProfileLink } from "./features/app";
import { Modal } from "@shared/components/Modal";
import { HomeRoute, PostRoute, ProfileRoute } from "./features/app";
import { useComposeNudge, useConnectNudge, useConnectWallet } from "./features/app";
import { ScrollToTop } from "./features/app/components/ScrollToTop";
import { useStatusActions } from "./features/status";
import { useTheme } from "./features/theme";
import { useComposer } from "./features/composer";
import { useContractActions } from "./features/contract";
import { useProfileState } from "./features/profile";
import { useFeedActions } from "./features/feed";
import { useWalletActions, useWalletState } from "./features/wallet";
import { ipfsToHttp } from "./features/ipfs";

function AppInner() {
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

  return (
    <div className="app">
      <ScrollToTop />
      <Topbar
        theme={theme.theme}
        connectNudge={connectNudge}
        composeNudge={composeNudge}
        walletAddress={walletState.walletAddress}
        onToggleTheme={theme.toggleTheme}
        onConnectWallet={connectWallet}
        onOpenComposer={composer.openComposer}
        rightSlot={
          <WalletProfileLink
            profileLink={profile.profileLink}
            walletAddress={walletState.walletAddress}
            chainId={walletState.chainId}
          />
        }
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
          onDraftFieldChange={composer.handleDraftChange}
          onImageUrlChange={composer.onComposerImageUrlChange}
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
        <Route path="/post/:chainId/:tokenId" element={<PostRoute />} />
        <Route path="/post/:tokenId" element={<PostRoute />} />
        <Route path="/profile/:address" element={<ProfileRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <TxToaster />
    </div>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppInner />
    </AppProviders>
  );
}
