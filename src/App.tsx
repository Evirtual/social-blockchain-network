import {
  ComposerProvider,
  ContractProvider,
  FeedProvider,
  FollowProvider,
  ProfileProvider,
  SocialActionsProvider,
  StatusProvider,
  ThemeProvider,
  TxNotificationsProvider,
  WalletProvider
} from "./features/app";
import { Navigate, Route, Routes } from "react-router-dom";
import { ComposerCard, Modal, Topbar, TxToaster, WalletProfileLink } from "./features/app";
import { HomeRoute, PostRoute, ProfileRoute } from "./features/app";
import { useConnectNudge, useConnectWallet } from "./features/app";
import { useComposer, useContract, useFeed, useStatus, useTheme, useWallet } from "./features/app";
import { useProfile } from "./features/app/providers/useProfile";

function AppInner() {
  const theme = useTheme();
  const wallet = useWallet();
  const contract = useContract();
  const feed = useFeed();
  const profile = useProfile();
  const composer = useComposer();
  const { setStatus } = useStatus();

  const { connectNudge, triggerConnectNudge } = useConnectNudge();
  const connectWallet = useConnectWallet({
    wallet,
    contract,
    feed,
    setStatus,
    triggerConnectNudge
  });

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
          <WalletProfileLink profileLink={profile.profileLink} walletAddress={wallet.walletAddress} chainId={wallet.chainId} />
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
          <div className="muted">Posting is in closed beta. Request approval, then wait for an admin to approve your wallet.</div>
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

export default function App() {
  return (
    <TxNotificationsProvider>
      <StatusProvider>
        <ThemeProvider>
          <WalletProvider>
            <ContractProvider>
              <FeedProvider>
                <ProfileProvider>
                  <FollowProvider>
                    <ComposerProvider>
                      <SocialActionsProvider>
                        <AppInner />
                      </SocialActionsProvider>
                    </ComposerProvider>
                  </FollowProvider>
                </ProfileProvider>
              </FeedProvider>
            </ContractProvider>
          </WalletProvider>
        </ThemeProvider>
      </StatusProvider>
    </TxNotificationsProvider>
  );
}