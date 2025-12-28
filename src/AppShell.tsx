import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ComposerCard } from "./components/ComposerCard";
import { Modal } from "./components/Modal";
import { Topbar } from "./components/Topbar";
import { TxToaster } from "./components/TxToaster";
import { getNetworkBadgeLabel } from "./lib/chain";
import { getErrorMessage } from "./lib/errors";
import { shortAddress } from "./lib/format";
import { HomeRoute } from "./routes/HomeRoute";
import { PostRoute } from "./routes/PostRoute";
import { ProfileRoute } from "./routes/ProfileRoute";
import { useTheme } from "./contexts/ThemeContext";
import { useWallet } from "./contexts/WalletContext";
import { useContract } from "./contexts/ContractContext";
import { useFeed } from "./contexts/FeedContext";
import { useProfile } from "./contexts/ProfileContext";
import { useComposer } from "./contexts/ComposerContext";
import { useStatus } from "./contexts/StatusContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONNECT_NUDGE_EVENT_NAME } from "./lib/connectNudge";

export function AppShell() {
  const theme = useTheme();
  const wallet = useWallet();
  const contract = useContract();
  const feed = useFeed();
  const profile = useProfile();
  const composer = useComposer();
  const { setStatus } = useStatus();

  const [connectNudge, setConnectNudge] = useState(false);
  const connectNudgeTimeoutRef = useRef<number | null>(null);

  const triggerConnectNudge = useCallback(() => {
    setConnectNudge(true);
    if (connectNudgeTimeoutRef.current !== null) {
      window.clearTimeout(connectNudgeTimeoutRef.current);
    }
    connectNudgeTimeoutRef.current = window.setTimeout(() => {
      setConnectNudge(false);
      connectNudgeTimeoutRef.current = null;
    }, 1400);
  }, []);

  useEffect(() => {
    const handleNudge = () => triggerConnectNudge();
    window.addEventListener(CONNECT_NUDGE_EVENT_NAME, handleNudge);
    return () => {
      window.removeEventListener(CONNECT_NUDGE_EVENT_NAME, handleNudge);
      if (connectNudgeTimeoutRef.current !== null) {
        window.clearTimeout(connectNudgeTimeoutRef.current);
        connectNudgeTimeoutRef.current = null;
      }
    };
  }, [triggerConnectNudge]);

  const connectWallet = useCallback(async () => {
    const addr = await wallet.connectWallet();
    if (!addr) {
      triggerConnectNudge();
      return;
    }

    try {
      await contract.refreshContractState();
    } catch {
      // ignore
    }

    try {
      await contract.ensureContractDeployedOnCurrentNetwork();
    } catch (err) {
      setStatus(getErrorMessage(err));
    }

    void wallet.refreshWalletPanel();
    void feed.refreshFeed(addr);
  }, [wallet, contract, setStatus, feed, triggerConnectNudge]);

  return (
    <div className="app">
      <Topbar
        theme={theme.theme}
        connectNudge={connectNudge}
        walletAddress={wallet.walletAddress}
        onToggleTheme={theme.toggleTheme}
        onConnectWallet={connectWallet}
        onOpenComposer={composer.openComposer}
        rightSlot={
          profile.profileLink ? (
            <Link className="btn secondary" to={profile.profileLink}>
              {wallet.walletAddress ? (
                <>
                  {shortAddress(wallet.walletAddress)}
                  {typeof wallet.chainId === "string" && wallet.chainId ? (
                    <span className="badge">{getNetworkBadgeLabel(wallet.chainId)}</span>
                  ) : null}
                </>
              ) : (
                ""
              )}
            </Link>
          ) : null
        }
      />

      <Modal open={composer.isComposerOpen} title="Create a post" onClose={composer.closeComposer}>
        <ComposerCard
          selfAvatarHue={profile.selfAvatarHue}
          ipfsConfigured={composer.ipfsConfigured}
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
          <div className="muted">
            Posting is in closed beta. Request approval, then wait for an admin to approve your wallet.
          </div>
          <div className="rowActions">
            <button className="secondary" type="button" onClick={composer.dismissApproval}>
              Close
            </button>
            <button className="primary" type="button" onClick={composer.requestApproval}>
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
