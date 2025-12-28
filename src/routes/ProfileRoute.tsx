import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { AccountPage } from "../pages/AccountPage";
import { ProfilePage } from "../pages/ProfilePage";
import { useContractTx } from "../contexts/useContractTx";
import { useContract } from "../contexts/ContractContext";
import { isAddress } from "ethers";
import { hasPinata, pinataPinFile } from "../ipfs";
import { bestEffortUnpinCids, collectReferencedIpfsCidsFromPosts } from "../lib/pinataCleanup";
import { getScanProviderFromReadContract } from "../lib/contractRunner";
import { discoverMintedTokenIdsForAuthor } from "../lib/mintedTokenDiscovery";
import { fetchPosterStatuses } from "../lib/posterStatus";
import { collectPinnedCidsForTokenIds } from "../lib/pinataTokenCids";
import { useWallet } from "../contexts/WalletContext";
import { useFeed } from "../contexts/FeedContext";
import { useProfile } from "../contexts/ProfileContext";
import { useFollow } from "../contexts/FollowContext";
import { useSocialActions } from "../contexts/SocialActionsContext";
import { useStatus } from "../contexts/StatusContext";
import { shortAddress, stableHueFromSeed } from "../lib/format";
import { getExplorerTxUrl, getNativeSymbol } from "../lib/chain";
import type { Draft } from "../types";
import { useLikedPostsByAddress } from "../hooks/useLikedPostsByAddress";
import { useSavedPostsByAddress } from "../hooks/useSavedPostsByAddress";

export function ProfileRoute() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const feed = useFeed();
  const profileCtx = useProfile();
  const follow = useFollow();
  const social = useSocialActions();
  const { status, setStatus } = useStatus();
  const contract = useContract();
  const { runContractTx } = useContractTx();
  const params = useParams();
  const address = typeof params.address === "string" ? params.address : "";

  const onDisconnectWallet = useCallback(() => {
    wallet.disconnectWallet();
    navigate("/", { replace: true });
  }, [wallet, navigate]);

  const onSaveProfile = useCallback(() => {
    void profileCtx.saveProfile();
  }, [profileCtx]);

  const onWithdrawTips = useCallback(async () => {
    await social.withdrawTips();
    try {
      await contract.refreshContractState();
    } catch {
      // ignore
    }
  }, [social, contract]);

  const onSetEditDraft = useCallback((next: Draft) => {
    social.setEditDraft(next);
  }, [social]);

  const onSaveEditedPost = useCallback(() => {
    void social.saveEditedPost();
  }, [social]);

  const onEditSelectFile = useCallback((file: File | null) => {
    void social.onEditSelectFile(file);
  }, [social]);

  const onAction = useCallback(
    (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null, comment?: string) => {
      return social.handleAction(tokenId, action, postChainId, comment);
    },
    [social]
  );

  const onTip = useCallback(
    async (tokenId: string, amountRaw: string, postChainId?: string | null) => {
      const ok = await social.handleTip(tokenId, amountRaw, postChainId);
      if (!ok) return false;
      try {
        await contract.refreshContractState();
      } catch {
        // ignore
      }
      return true;
    },
    [social, contract]
  );

  const onBurn = useCallback(
    (tokenId: string, postChainId?: string | null) => {
      void social.burnPost(tokenId, postChainId);
    },
    [social]
  );

  const onFreeze = useCallback(
    (tokenId: string, postChainId?: string | null) => {
      void social.freezePost(tokenId, postChainId);
    },
    [social]
  );

  if (!address) {
    return <Navigate to="/" replace />;
  }

  const key = address.toLowerCase();

  const isSelf = !!wallet.walletAddress && wallet.walletAddress.toLowerCase() === key;

  const onToggleFollow = useCallback(() => {
    void follow.toggleFollow(address);
  }, [follow, address]);

  const onAdminSetPosterAllowed = useCallback(
    async (allowed: boolean) => {
      if (!contract.isOwner) return;
      if (!isAddress(address)) return;

      await runContractTx(allowed ? "Approve poster" : "Disapprove poster", async () => {
        const writeContract = await contract.getWriteContract();
        return (writeContract as any).setPosterAllowed(address, allowed);
      });

      setIsPosterAllowed(allowed);
      if (!allowed) setWasPosterDisapprovedEver(true);
    },
    [contract, address, runContractTx]
  );

  const onAdminReset = useCallback(async () => {
    if (!contract.isOwner) return;
    const normalized = address.trim();
    if (!isAddress(normalized)) return;

    let tokenIds: bigint[] = [];
    {
      const readContract = await contract.getReadContract();
      const provider: any = getScanProviderFromReadContract(readContract);
      const discovered = await discoverMintedTokenIdsForAuthor({ readContract, scanProvider: provider, author: normalized });
      tokenIds = discovered.tokenIds;
    }

    try {
      await runContractTx("Reset account", async () => {
        let pinnedCids: Set<string> | null = null;
        try {
          if (hasPinata() && tokenIds.length) {
            const readContract = await contract.getReadContract();
            pinnedCids = await collectPinnedCidsForTokenIds({ readContract, tokenIds, concurrency: 4 });
            (contract as any).__lastResetPinnedCids = pinnedCids;
          }
        } catch {
          (contract as any).__lastResetPinnedCids = null;
        }

        const writeContract = await contract.getWriteContract();
        return (writeContract as any).adminResetAccount(normalized, tokenIds);
      });
    } catch {
      return;
    }

    try {
      const pinned = (contract as any).__lastResetPinnedCids as Set<string> | null | undefined;
      (contract as any).__lastResetPinnedCids = null;
      if (pinned && pinned.size) {
        const excludeTokenIds = tokenIds.map((x) => x.toString());
        const referenced = collectReferencedIpfsCidsFromPosts(feed.posts, {
          exclude: { chainId: wallet.chainId, tokenIds: excludeTokenIds }
        });
        void bestEffortUnpinCids(pinned, { protectReferencedIn: referenced });
      }
    } catch {
      // ignore
    }

    setIsPosterAllowed(false);
    setWasPosterDisapprovedEver(true);

    try {
      await profileCtx.loadProfile(normalized);
    } catch {
      // ignore
    }

    try {
      await feed.refreshFeed();
    } catch {
      // ignore
    }
  }, [contract, address, runContractTx, feed, wallet.chainId, profileCtx]);

  const onAdminSetProfile = useCallback(
    async (next: {
      name: string;
      bio: string;
      avatarUrl: string;
      avatarFile?: File | null;
      avatarFilename?: string;
      avatarDataUrl?: string;
    }) => {
      if (!contract.isOwner) return;
      if (!isAddress(address)) return;

      const name = next.name.trim();
      const bio = next.bio.trim();
      let avatar = next.avatarUrl.trim();

      if (next.avatarFile) {
        if (hasPinata()) {
          const pinned = await pinataPinFile(next.avatarFile, next.avatarFilename || "avatar.png");
          avatar = `ipfs://${pinned.IpfsHash}`;
        } else {
          avatar = next.avatarDataUrl || "";
        }
      }

      await runContractTx("Admin set profile", async () => {
        const writeContract = await contract.getWriteContract();
        return (writeContract as any).adminSetProfile(address, name, bio, avatar);
      });

      await profileCtx.loadProfile(address);
    },
    [contract, address, runContractTx, profileCtx]
  );

  const { likedTokenIdsByAddress, isLoadingLikesByAddress, loadLikesForAddress } = useLikedPostsByAddress({
    walletProvider: wallet.provider,
    chainId: wallet.chainId,
    contractAddress: contract.contractAddress,
    ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contract.getReadContract,
    loadPostsByTokenIds: feed.loadPostsByTokenIds,
    setStatus
  });

  const { savedTokenIdsByAddress, isLoadingSavedByAddress, loadSavedForAddress } = useSavedPostsByAddress({
    walletProvider: wallet.provider,
    chainId: wallet.chainId,
    contractAddress: contract.contractAddress,
    ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contract.getReadContract,
    loadPostsByTokenIds: feed.loadPostsByTokenIds,
    setStatus
  });

  useEffect(() => {
    void profileCtx.loadProfile(address);
  }, [profileCtx, address]);

  useEffect(() => {
    if (!wallet.walletAddress) return;
    if (isSelf) return;
    void follow.loadIsFollowing(address);
  }, [address, wallet.walletAddress, follow.loadIsFollowing, isSelf]);

  useEffect(() => {
    if (!wallet.walletAddress) return;
    if (!isSelf) return;
    void loadSavedForAddress(address);
    void loadLikesForAddress(address);
  }, [address, loadLikesForAddress, loadSavedForAddress, wallet.walletAddress, isSelf]);

  useEffect(() => {
    if (!wallet.walletAddress) return;
    if (!isSelf) return;
    void follow.loadFollowerCountForAddress(address);
    void follow.loadFollowersForAddress(address);
    void follow.loadFollowingForAddress(address);
  }, [
    address,
    wallet.walletAddress,
    follow.loadFollowerCountForAddress,
    follow.loadFollowersForAddress,
    follow.loadFollowingForAddress,
    isSelf
  ]);

  const profile = profileCtx.profilesByAddress[key];
  const name = profile?.name ?? "";
  const bio = profile?.bio ?? "";
  const avatarUrl = profile?.avatarUrl ?? "";

  const filtered = feed.posts.filter((p) => p.author?.toLowerCase() === key);

  const [isPosterAllowed, setIsPosterAllowed] = useState<boolean | undefined>(undefined);
  const [wasPosterDisapprovedEver, setWasPosterDisapprovedEver] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!contract.isOwner) return;
    if (!isAddress(address)) return;

    let cancelled = false;
    void (async () => {
      try {
        await contract.ensureContractDeployedOnCurrentNetwork();
        const readContract = await contract.getReadContract();
        const statuses = await fetchPosterStatuses(readContract, [address]);
        const first = statuses[0];
        const allowed = first?.allowed ?? false;
        const disapprovedEver = first?.disapprovedEver ?? false;
        if (cancelled) return;
        setIsPosterAllowed(allowed);
        setWasPosterDisapprovedEver(disapprovedEver);
      } catch {
        if (cancelled) return;
        setIsPosterAllowed(undefined);
        setWasPosterDisapprovedEver(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, contract, contract.isOwner]);

  if (isSelf) {
    const selfKey = wallet.walletAddress!.toLowerCase();

    const normalizeChainId = (v: string | null | undefined) => {
      const s = String(v ?? "").trim();
      if (!s) return "";
      const n = s.startsWith("0x") || s.startsWith("0X") ? Number.parseInt(s, 16) : Number.parseInt(s, 10);
      return Number.isFinite(n) ? String(n) : s;
    };

    const postsByKey = new Map(
      feed.posts.map((p) => {
        const k = `${normalizeChainId(p.chainId ?? null)}:${p.tokenId}`;
        return [k, p] as const;
      })
    );

    const savedFromFeed = (() => {
      const seen = new Set<string>();
      const out: typeof feed.posts = [];
      for (const p of feed.posts) {
        if (!p.savedByMe) continue;
        const k = `${normalizeChainId(p.chainId ?? null)}:${p.tokenId}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(p);
      }
      return out;
    })();

    const likedFromFeed = (() => {
      const seen = new Set<string>();
      const out: typeof feed.posts = [];
      for (const p of feed.posts) {
        if (!p.likedByMe) continue;
        const k = `${normalizeChainId(p.chainId ?? null)}:${p.tokenId}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(p);
      }
      return out;
    })();

    const savedKeys = savedTokenIdsByAddress[selfKey] ?? [];
    const savedPosts =
      savedFromFeed.length > 0
        ? savedFromFeed
        : savedKeys
            .map((savedKey) => {
              if (savedKey.includes(":")) {
                const [chainPart, tokenId] = savedKey.split(":");
                const normalized = `${normalizeChainId(chainPart)}:${tokenId}`;
                return postsByKey.get(normalized) ?? feed.posts.find((p) => p.tokenId === tokenId);
              }
              return feed.posts.find((p) => p.tokenId === savedKey);
            })
            .filter((p): p is NonNullable<typeof p> => !!p);

    const likedKeys = likedTokenIdsByAddress[selfKey] ?? [];
    const likedPosts =
      likedFromFeed.length > 0
        ? likedFromFeed
        : likedKeys
            .map((likedKey) => {
              if (likedKey.includes(":")) {
                const [chainPart, tokenId] = likedKey.split(":");
                const normalized = `${normalizeChainId(chainPart)}:${tokenId}`;
                return postsByKey.get(normalized) ?? feed.posts.find((p) => p.tokenId === tokenId);
              }
              return feed.posts.find((p) => p.tokenId === likedKey);
            })
            .filter((p): p is NonNullable<typeof p> => !!p);


    return (
      <AccountPage
        isOwner={contract.isOwner}
        sidebar={{
          walletAddress: wallet.walletAddress,
          displayName: profileCtx.displayName,
          profileBio: profileCtx.profileBio,
          profileAvatarUrl: profileCtx.profileAvatarUrl,
          myPostsCount: profileCtx.myPostsCount,
          followerCount: follow.followerCountByAddress[selfKey],
          followers: follow.followersByAddress[selfKey] ?? null,
          following: follow.followingByAddress[selfKey] ?? null,
          isLoadingFollowers: !!follow.isLoadingFollowersByAddress[selfKey],
          isLoadingFollowing: !!follow.isLoadingFollowingByAddress[selfKey],
          onDisconnectWallet,
          isEditingProfile: profileCtx.isEditingProfile,
          profileDraftName: profileCtx.profileDraftName,
          profileDraftBio: profileCtx.profileDraftBio,
          profileDraftAvatarUrl: profileCtx.profileDraftAvatarUrl,
          profileDraftAvatarDataUrl: profileCtx.profileDraftAvatarDataUrl,
          isProfileAvatarLoading: profileCtx.isProfileAvatarLoading,
          onProfileDraftNameChange: profileCtx.setProfileDraftName,
          onProfileDraftBioChange: profileCtx.setProfileDraftBio,
          onProfileDraftAvatarUrlChange: profileCtx.setProfileDraftAvatarUrl,
          onSelectProfileAvatarFile: profileCtx.onSelectProfileAvatarFile,
          onClearProfileAvatar: profileCtx.onClearProfileAvatar,
          onStartEditProfile: profileCtx.startEditProfile,
          onCancelEditProfile: profileCtx.cancelEditProfile,
          onSaveProfile,
          selfAvatarHue: profileCtx.selfAvatarHue,
          chainId: wallet.chainId,
          networkName: wallet.networkName,
          nativeBalance: wallet.nativeBalance,
          withdrawableTipsWei: contract.withdrawableTipsWei,
          contractAddress: contract.contractAddress,
          contractDeployed: contract.contractDeployed,
          status,
          onWithdrawTips,
          shortAddress,
          getNativeSymbol
        }}
        status={status}
        isFeedLoading={feed.isFeedLoading}
        posts={filtered}
        savedPosts={savedPosts}
        likedPosts={likedPosts}
        isLoadingSaved={!!isLoadingSavedByAddress[selfKey]}
        isLoadingLiked={!!isLoadingLikesByAddress[selfKey]}
        chainId={wallet.chainId}
        walletAddress={wallet.walletAddress}
        authorIdentity={profileCtx.authorIdentity}
        editingTokenId={social.editingTokenId}
        editDraft={social.editDraft}
        isEditImageLoading={social.isEditImageLoading}
        onSetEditDraft={onSetEditDraft}
        onStartEditPost={social.startEditPost}
        onCancelEditPost={social.cancelEditPost}
        onSaveEditedPost={onSaveEditedPost}
        onEditSelectFile={onEditSelectFile}
        onEditClearImage={social.onEditClearImage}
        onAction={onAction}
        onTip={onTip}
        onBurn={onBurn}
        onFreezePost={onFreeze}
        shortAddress={shortAddress}
        stableHueFromSeed={stableHueFromSeed}
        getNativeSymbol={getNativeSymbol}
        getExplorerTxUrl={getExplorerTxUrl}
      />
    );
  }

  return (
    <ProfilePage
      isOwner={contract.isOwner}
      isPosterAllowed={isPosterAllowed}
      wasPosterDisapprovedEver={wasPosterDisapprovedEver}
      address={address}
      name={name}
      bio={bio}
      avatarHue={stableHueFromSeed(key)}
      avatarUrl={avatarUrl}
      isFollowing={follow.isFollowingByAddress[key]}
      onToggleFollow={onToggleFollow}
      onAdminSetPosterAllowed={onAdminSetPosterAllowed}
      onAdminReset={onAdminReset}
      onAdminSetProfile={onAdminSetProfile}
      posts={filtered}
      chainId={wallet.chainId}
      status={status}
      isFeedLoading={feed.isFeedLoading}
      walletAddress={wallet.walletAddress}
      authorIdentity={profileCtx.authorIdentity}
      editingTokenId={social.editingTokenId}
      editDraft={social.editDraft}
      isEditImageLoading={social.isEditImageLoading}
      onSetEditDraft={onSetEditDraft}
      onStartEditPost={social.startEditPost}
      onCancelEditPost={social.cancelEditPost}
      onSaveEditedPost={onSaveEditedPost}
      onEditSelectFile={onEditSelectFile}
      onEditClearImage={social.onEditClearImage}
      onAction={onAction}
      onTip={onTip}
      onBurn={onBurn}
      onFreezePost={onFreeze}
      shortAddress={shortAddress}
      stableHueFromSeed={stableHueFromSeed}
      getNativeSymbol={getNativeSymbol}
      getExplorerTxUrl={getExplorerTxUrl}
    />
  );
}
