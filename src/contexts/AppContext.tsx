import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { socialInterface } from "../contracts/socialPosts";
import { getExplorerTxUrl, getNativeSymbol } from "../lib/chain";
import { getErrorMessage } from "../lib/errors";
import { shortAddress, stableHueFromSeed } from "../lib/format";
import type { AppContextValue } from "./AppContext.types";

import { useContract } from "./ContractContext";
import { ComposerProvider, useComposer } from "./ComposerContext";
import { FeedProvider, useFeed } from "./FeedContext";
import { FollowProvider, useFollow } from "./FollowContext";
import { ProfileProvider, useProfile } from "./ProfileContext";
import { SocialActionsProvider, useSocialActions } from "./SocialActionsContext";
import { useStatus } from "./StatusContext";
import { useTheme } from "./ThemeContext";
import { useWallet } from "./WalletContext";

const AppContext = createContext<AppContextValue | null>(null);

function AppProviderInner({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const wallet = useWallet();
  const contract = useContract();
  const { status, setStatus } = useStatus();

  const feed = useFeed();
  const profile = useProfile();
  const follow = useFollow();
  const composer = useComposer();
  const social = useSocialActions();

  // Reposts live here for now (not yet extracted into its own context).
  const [repostTokenIdsByAddress, setRepostTokenIdsByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingRepostsByAddress, setIsLoadingRepostsByAddress] = useState<Record<string, boolean>>({});
  const repostsInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const connectWallet = useCallback(async () => {
    const addr = await wallet.connectWallet();
    if (!addr) return;

    // Refresh contract/wallet UI state best-effort.
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
  }, [wallet, contract, setStatus, feed]);

  const refreshFeed = useCallback(async () => {
    await feed.refreshFeed();
  }, [feed]);

  const loadRepostsForAddress = useCallback(
    async (address: string) => {
      try {
        if (!wallet.provider) return;
        if (!address) return;

        const key = address.toLowerCase();
        const existing = repostsInFlightRef.current[key];
        if (existing) {
          await existing;
          return;
        }

        const task = (async () => {
          setIsLoadingRepostsByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            await contract.ensureContractDeployedOnCurrentNetwork();
            const readContract = await contract.getReadContract();

            const latest = await wallet.provider!.getBlockNumber();
            const maxRounds = 60;
            const maxEvents = 5_000;
            let windowSize = 75_000;
            const minWindowSize = 2_000;

            const collected: ethers.Log[] = [];

            const pullRange = async (fromBlock: number, toBlock: number) => {
              const [shared, unshared] = await Promise.all([
                (readContract as any).queryFilter(
                  (readContract as any).filters.PostShared(address, null),
                  fromBlock,
                  toBlock
                ),
                (readContract as any).queryFilter(
                  (readContract as any).filters.PostUnshared(address, null),
                  fromBlock,
                  toBlock
                )
              ]);
              return [...(shared as any[]), ...(unshared as any[])].sort((a, b) => {
                const ab = Number(a.blockNumber ?? 0);
                const bb = Number(b.blockNumber ?? 0);
                if (ab !== bb) return ab - bb;
                const ai = Number(a.index ?? a.logIndex ?? 0);
                const bi = Number(b.index ?? b.logIndex ?? 0);
                return ai - bi;
              });
            };

            let end = latest;
            for (let round = 0; round < maxRounds && end >= 0 && collected.length < maxEvents; round++) {
              const start = Math.max(0, end - windowSize);
              try {
                const logs = await pullRange(start, end);
                collected.unshift(...(logs as any));
                if (start === 0) break;
                end = start - 1;
              } catch {
                if (windowSize <= minWindowSize) throw new Error("RPC could not serve repost log range.");
                windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
              }
            }

            const state = new Map<string, { shared: boolean; lastBlock: number }>();
            for (const log of collected) {
              let parsed: ethers.LogDescription | null = null;
              try {
                parsed = socialInterface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
              } catch {
                parsed = null;
              }
              if (!parsed) continue;

              const tokenIdBig = parsed.args?.[1] as bigint | undefined;
              if (!tokenIdBig) continue;

              const tokenId = tokenIdBig.toString();
              const blockNumber = Number((log as any).blockNumber ?? 0);

              if (parsed.name === "PostShared") {
                state.set(tokenId, { shared: true, lastBlock: blockNumber });
              } else if (parsed.name === "PostUnshared") {
                state.set(tokenId, { shared: false, lastBlock: blockNumber });
              }
            }

            const active = Array.from(state.entries())
              .filter(([, v]) => v.shared)
              .sort((a, b) => b[1].lastBlock - a[1].lastBlock)
              .map(([tokenId]) => tokenId);

            setRepostTokenIdsByAddress((prev) => ({ ...prev, [key]: active }));
            await feed.loadPostsByTokenIds(active);
          } finally {
            setIsLoadingRepostsByAddress((prev) => ({ ...prev, [key]: false }));
          }
        })();

        repostsInFlightRef.current[key] = task;
        try {
          await task;
        } finally {
          if (repostsInFlightRef.current[key] === task) repostsInFlightRef.current[key] = null;
        }
      } catch (err) {
        setStatus(getErrorMessage(err));
      }
    },
    [wallet.provider, contract, feed, setStatus]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      // Theme
      theme: theme.theme,
      toggleTheme: theme.toggleTheme,

      // Wallet + chain
      walletAddress: wallet.walletAddress,
      chainId: wallet.chainId,
      networkName: wallet.networkName,
      nativeBalance: wallet.nativeBalance,
      contractDeployed: contract.contractDeployed,
      contractAddress: contract.contractAddress,
      status,
      withdrawableTipsWei: contract.withdrawableTipsWei,

      connectWallet,
      disconnectWallet: wallet.disconnectWallet,
      refreshWalletPanel: wallet.refreshWalletPanel,
      withdrawTips: social.withdrawTips,

      // Feed loading
      isFeedLoading: feed.isFeedLoading,

      // Composer
      isComposerOpen: composer.isComposerOpen,
      openComposer: composer.openComposer,
      closeComposer: composer.closeComposer,
      ipfsConfigured: composer.ipfsConfigured,

      draft: composer.draft,
      isImageLoading: composer.isImageLoading,
      handleDraftChange: composer.handleDraftChange,
      onComposerImageUrlChange: composer.onComposerImageUrlChange,
      onComposerClearImage: composer.onComposerClearImage,
      onSelectComposerFile: composer.onSelectComposerFile,
      mintPost: composer.mintPost,

      // Feed + posts
      posts: feed.posts,
      refreshFeed,
      authorIdentity: profile.authorIdentity,

      // On-chain profiles (cache)
      profilesByAddress: profile.profilesByAddress,
      loadProfile: profile.loadProfile,

      // Profile (self)
      profileName: profile.profileName,
      profileBio: profile.profileBio,
      profileAvatarUrl: profile.profileAvatarUrl,
      displayName: profile.displayName,
      myPostsCount: profile.myPostsCount,
      isEditingProfile: profile.isEditingProfile,
      profileDraftName: profile.profileDraftName,
      profileDraftBio: profile.profileDraftBio,
      profileDraftAvatarUrl: profile.profileDraftAvatarUrl,
      profileDraftAvatarDataUrl: profile.profileDraftAvatarDataUrl,
      isProfileAvatarLoading: profile.isProfileAvatarLoading,
      setProfileDraftName: profile.setProfileDraftName,
      setProfileDraftBio: profile.setProfileDraftBio,
      setProfileDraftAvatarUrl: profile.setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile: profile.onSelectProfileAvatarFile,
      onClearProfileAvatar: profile.onClearProfileAvatar,
      startEditProfile: profile.startEditProfile,
      cancelEditProfile: profile.cancelEditProfile,
      saveProfile: profile.saveProfile,
      selfAvatarHue: profile.selfAvatarHue,
      profileLink: profile.profileLink,

      // Per-post UI state + actions
      editingTokenId: social.editingTokenId,
      editDraft: social.editDraft,
      isEditImageLoading: social.isEditImageLoading,
      tipDrafts: social.tipDrafts,
      commentDrafts: social.commentDrafts,

      setEditDraft: social.setEditDraft,

      onTipDraftChange: social.onTipDraftChange,
      onCommentDraftChange: social.onCommentDraftChange,
      onEditSelectFile: social.onEditSelectFile,
      onEditClearImage: social.onEditClearImage,
      startEditPost: social.startEditPost,
      cancelEditPost: social.cancelEditPost,
      saveEditedPost: social.saveEditedPost,
      burnPost: social.burnPost,
      handleAction: social.handleAction,
      handleTip: social.handleTip,
      freezePost: social.freezePost,

      // Comments
      postComments: feed.postComments,
      isLoadingPostComments: feed.isLoadingPostComments,
      loadCommentsForPost: feed.loadCommentsForPost,

      // Follow graph (cache)
      isFollowingByAddress: follow.isFollowingByAddress,
      loadIsFollowing: follow.loadIsFollowing,
      toggleFollow: follow.toggleFollow,

      // Reposts (shares)
      repostTokenIdsByAddress,
      isLoadingRepostsByAddress,
      loadRepostsForAddress,

      // Followers
      followerCountByAddress: follow.followerCountByAddress,
      isLoadingFollowerCountByAddress: follow.isLoadingFollowerCountByAddress,
      loadFollowerCountForAddress: follow.loadFollowerCountForAddress,

      // Followers + Following lists
      followersByAddress: follow.followersByAddress,
      isLoadingFollowersByAddress: follow.isLoadingFollowersByAddress,
      loadFollowersForAddress: follow.loadFollowersForAddress,
      followingByAddress: follow.followingByAddress,
      isLoadingFollowingByAddress: follow.isLoadingFollowingByAddress,
      loadFollowingForAddress: follow.loadFollowingForAddress,

      // Shared helpers
      shortAddress,
      stableHueFromSeed,
      getNativeSymbol,
      getExplorerTxUrl
    }),
    [
      theme.theme,
      theme.toggleTheme,
      wallet.walletAddress,
      wallet.chainId,
      wallet.networkName,
      wallet.nativeBalance,
      wallet.disconnectWallet,
      wallet.refreshWalletPanel,
      contract.contractDeployed,
      contract.contractAddress,
      contract.withdrawableTipsWei,
      status,
      connectWallet,
      social.withdrawTips,
      feed.isFeedLoading,
      composer.isComposerOpen,
      composer.openComposer,
      composer.closeComposer,
      composer.ipfsConfigured,
      composer.draft,
      composer.isImageLoading,
      composer.handleDraftChange,
      composer.onComposerImageUrlChange,
      composer.onComposerClearImage,
      composer.onSelectComposerFile,
      composer.mintPost,
      feed.posts,
      refreshFeed,
      profile.authorIdentity,
      profile.profilesByAddress,
      profile.loadProfile,
      profile.profileName,
      profile.profileBio,
      profile.profileAvatarUrl,
      profile.displayName,
      profile.myPostsCount,
      profile.isEditingProfile,
      profile.profileDraftName,
      profile.profileDraftBio,
      profile.profileDraftAvatarUrl,
      profile.profileDraftAvatarDataUrl,
      profile.isProfileAvatarLoading,
      profile.setProfileDraftName,
      profile.setProfileDraftBio,
      profile.setProfileDraftAvatarUrl,
      profile.onSelectProfileAvatarFile,
      profile.onClearProfileAvatar,
      profile.startEditProfile,
      profile.cancelEditProfile,
      profile.profileLink,
      profile.saveProfile,
      profile.selfAvatarHue,
      social.editingTokenId,
      social.editDraft,
      social.isEditImageLoading,
      social.tipDrafts,
      social.commentDrafts,
      social.setEditDraft,
      social.onTipDraftChange,
      social.onCommentDraftChange,
      social.onEditSelectFile,
      social.onEditClearImage,
      social.startEditPost,
      social.cancelEditPost,
      social.saveEditedPost,
      social.burnPost,
      social.handleAction,
      social.handleTip,
      social.freezePost,
      feed.postComments,
      feed.isLoadingPostComments,
      feed.loadCommentsForPost,
      follow.isFollowingByAddress,
      follow.loadIsFollowing,
      follow.toggleFollow,
      repostTokenIdsByAddress,
      isLoadingRepostsByAddress,
      loadRepostsForAddress,
      follow.followerCountByAddress,
      follow.isLoadingFollowerCountByAddress,
      follow.loadFollowerCountForAddress,
      follow.followersByAddress,
      follow.isLoadingFollowersByAddress,
      follow.loadFollowersForAddress,
      follow.followingByAddress,
      follow.isLoadingFollowingByAddress,
      follow.loadFollowingForAddress
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <FeedProvider>
      <ProfileProvider>
        <FollowProvider>
          <ComposerProvider>
            <SocialActionsProvider>
              <AppProviderInner>{children}</AppProviderInner>
            </SocialActionsProvider>
          </ComposerProvider>
        </FollowProvider>
      </ProfileProvider>
    </FeedProvider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
