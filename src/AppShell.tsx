import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ComposerCard } from "./components/ComposerCard";
import { Modal } from "./components/Modal";
import { Topbar } from "./components/Topbar";
import { TxToaster } from "./components/TxToaster";
import { useApp } from "./contexts/AppContext";
import { getNetworkBadgeLabel } from "./lib/chain";
import { HomeRoute } from "./routes/HomeRoute";
import { PostRoute } from "./routes/PostRoute";
import { ProfileRoute } from "./routes/ProfileRoute";

export function AppShell() {
  const app = useApp();

  return (
    <div className="app">
      <Topbar
        theme={app.theme}
        connectNudge={app.connectNudge}
        walletAddress={app.walletAddress}
        onToggleTheme={app.toggleTheme}
        onConnectWallet={app.connectWallet}
        onOpenComposer={app.openComposer}
        rightSlot={
          app.profileLink ? (
            <Link className="btn secondary" to={app.profileLink}>
              {app.walletAddress ? (
                <>
                  {app.shortAddress(app.walletAddress)}
                  {typeof app.chainId === "string" && app.chainId ? (
                    <span className="badge">{getNetworkBadgeLabel(app.chainId)}</span>
                  ) : null}
                </>
              ) : (
                ""
              )}
            </Link>
          ) : null
        }
      />

      <Modal open={app.isComposerOpen} title="Create a post" onClose={app.closeComposer}>
        <ComposerCard
          selfAvatarHue={app.selfAvatarHue}
          ipfsConfigured={app.ipfsConfigured}
          draft={app.draft}
          isImageLoading={app.isImageLoading}
          onDraftFieldChange={app.handleDraftChange}
          onImageUrlChange={app.onComposerImageUrlChange}
          onSelectFile={app.onSelectComposerFile}
          onClearImage={app.onComposerClearImage}
          onPost={app.mintPost}
        />
      </Modal>

      <Modal open={app.approvalRequired} title="Request posting approval" onClose={app.dismissApproval}>
        <div className="composer">
          <div className="muted">
            Posting is in closed beta. Request approval, then wait for an admin to approve your wallet.
          </div>
          <div className="rowActions">
            <button className="secondary" type="button" onClick={app.dismissApproval}>
              Close
            </button>
            <button className="primary" type="button" onClick={app.requestApproval}>
              {app.approvalRequested ? "Requested" : "Request approval"}
            </button>
          </div>
        </div>
      </Modal>

      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/post/:tokenId" element={<PostRoute />} />
        <Route path="/profile/:address" element={<ProfileRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <TxToaster />
    </div>
  );
}
