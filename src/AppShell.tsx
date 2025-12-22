import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ComposerCard } from "./components/ComposerCard";
import { Modal } from "./components/Modal";
import { Topbar } from "./components/Topbar";
import { TxToaster } from "./components/TxToaster";
import { useApp } from "./contexts/AppContext";
import { HomeRoute } from "./routes/HomeRoute";
import { PostRoute } from "./routes/PostRoute";
import { ProfileRoute } from "./routes/ProfileRoute";

export function AppShell() {
  const app = useApp();

  return (
    <div className="app">
      <Topbar
        theme={app.theme}
        walletAddress={app.walletAddress}
        onToggleTheme={app.toggleTheme}
        onConnectWallet={app.connectWallet}
        onOpenComposer={app.openComposer}
        rightSlot={
          app.profileLink ? (
            <Link className="btn secondary" to={app.profileLink}>
              {app.walletAddress ? app.shortAddress(app.walletAddress) : ""}
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
