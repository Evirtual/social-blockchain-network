import { Navigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AccountPage } from "../pages/AccountPage";
import { ProfilePage } from "../pages/ProfilePage";
import { useApp } from "../contexts/AppContext";
import { useContractTx } from "../contexts/useContractTx";
import { useContract } from "../contexts/ContractContext";
import { ethers } from "ethers";
import { hasPinata, pinataPinFile } from "../ipfs";

export function ProfileRoute() {
  const app = useApp();
  const contract = useContract();
  const { runContractTx } = useContractTx();
  const params = useParams();
  const address = typeof params.address === "string" ? params.address : "";

  if (!address) {
    return <Navigate to="/" replace />;
  }

  const key = address.toLowerCase();

  const isSelf = !!app.walletAddress && app.walletAddress.toLowerCase() === key;

  useEffect(() => {
    void app.loadProfile(address);
  }, [app, address]);

  useEffect(() => {
    if (!app.walletAddress) return;
    if (isSelf) return;
    void app.loadIsFollowing(address);
  }, [address, app.walletAddress, app.loadIsFollowing, isSelf]);

  useEffect(() => {
    if (!app.walletAddress) return;
    if (!isSelf) return;
    void app.loadRepostsForAddress(address);
  }, [address, app.loadRepostsForAddress, app.walletAddress, isSelf]);

  useEffect(() => {
    if (!app.walletAddress) return;
    if (!isSelf) return;
    void app.loadFollowerCountForAddress(address);
    void app.loadFollowersForAddress(address);
    void app.loadFollowingForAddress(address);
  }, [address, app.walletAddress, app.loadFollowerCountForAddress, app.loadFollowersForAddress, app.loadFollowingForAddress, isSelf]);

  const profile = app.profilesByAddress[key];
  const name = profile?.name ?? "";
  const bio = profile?.bio ?? "";
  const avatarUrl = profile?.avatarUrl ?? "";

  const filtered = app.posts.filter((p) => p.author?.toLowerCase() === key);

  const [isPosterAllowed, setIsPosterAllowed] = useState<boolean | undefined>(undefined);
  const [wasPosterDisapprovedEver, setWasPosterDisapprovedEver] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!app.isOwner) return;
    if (!ethers.isAddress(address)) return;

    let cancelled = false;
    void (async () => {
      try {
        await contract.ensureContractDeployedOnCurrentNetwork();
        const readContract = await contract.getReadContract();
        const allowed = (await (readContract as any).isPosterAllowed(address)) as boolean;
        const disapprovedEver = (await (readContract as any).wasPosterDisapproved(address)) as boolean;
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
  }, [address, contract, app.isOwner]);

  if (isSelf) {
    const selfKey = app.walletAddress!.toLowerCase();

    const savedTokenIds = app.repostTokenIdsByAddress[selfKey] ?? [];
    const savedPosts = savedTokenIds
      .map((tokenId) => app.posts.find((p) => p.tokenId === tokenId))
      .filter((p): p is NonNullable<typeof p> => !!p);

    return (
      <AccountPage
        isOwner={app.isOwner}
        sidebar={{
          walletAddress: app.walletAddress,
          displayName: app.displayName,
          profileBio: app.profileBio,
          profileAvatarUrl: app.profileAvatarUrl,
          myPostsCount: app.myPostsCount,
            followerCount: app.followerCountByAddress[selfKey],
            followers: app.followersByAddress[selfKey] ?? null,
            following: app.followingByAddress[selfKey] ?? null,
            isLoadingFollowers: !!app.isLoadingFollowersByAddress[selfKey],
            isLoadingFollowing: !!app.isLoadingFollowingByAddress[selfKey],
          onDisconnectWallet: app.disconnectWallet,
          isEditingProfile: app.isEditingProfile,
          profileDraftName: app.profileDraftName,
          profileDraftBio: app.profileDraftBio,
          profileDraftAvatarUrl: app.profileDraftAvatarUrl,
          profileDraftAvatarDataUrl: app.profileDraftAvatarDataUrl,
          isProfileAvatarLoading: app.isProfileAvatarLoading,
          onProfileDraftNameChange: app.setProfileDraftName,
          onProfileDraftBioChange: app.setProfileDraftBio,
          onProfileDraftAvatarUrlChange: app.setProfileDraftAvatarUrl,
          onSelectProfileAvatarFile: app.onSelectProfileAvatarFile,
          onClearProfileAvatar: app.onClearProfileAvatar,
          onStartEditProfile: app.startEditProfile,
          onCancelEditProfile: app.cancelEditProfile,
          onSaveProfile: app.saveProfile,
          selfAvatarHue: app.selfAvatarHue,
          chainId: app.chainId,
          networkName: app.networkName,
          nativeBalance: app.nativeBalance,
          withdrawableTipsWei: app.withdrawableTipsWei,
          contractAddress: app.contractAddress,
          contractDeployed: app.contractDeployed,
          status: app.status,
          onRefreshWalletPanel: app.refreshWalletPanel,
          onWithdrawTips: app.withdrawTips,
          shortAddress: app.shortAddress,
          getNativeSymbol: app.getNativeSymbol
        }}
        status={app.status}
        isFeedLoading={app.isFeedLoading}
        posts={filtered}
        savedPosts={savedPosts}
          isLoadingSaved={!!app.isLoadingRepostsByAddress[selfKey]}
        chainId={app.chainId}
        walletAddress={app.walletAddress}
        authorIdentity={app.authorIdentity}
        editingTokenId={app.editingTokenId}
        editDraft={app.editDraft}
        isEditImageLoading={app.isEditImageLoading}
        tipDrafts={app.tipDrafts}
        commentDrafts={app.commentDrafts}
        onSetEditDraft={app.setEditDraft}
        onTipDraftChange={app.onTipDraftChange}
        onCommentDraftChange={app.onCommentDraftChange}
        onStartEditPost={app.startEditPost}
        onCancelEditPost={app.cancelEditPost}
        onSaveEditedPost={app.saveEditedPost}
        onEditSelectFile={app.onEditSelectFile}
        onEditClearImage={app.onEditClearImage}
        onAction={app.handleAction}
        onTip={app.handleTip}
        onBurn={app.burnPost}
        onFreezePost={app.freezePost}
        shortAddress={app.shortAddress}
        stableHueFromSeed={app.stableHueFromSeed}
        getNativeSymbol={app.getNativeSymbol}
        getExplorerTxUrl={app.getExplorerTxUrl}
      />
    );
  }

  return (
    <ProfilePage
      isOwner={app.isOwner}
      isPosterAllowed={isPosterAllowed}
      wasPosterDisapprovedEver={wasPosterDisapprovedEver}
      address={address}
      name={name}
      bio={bio}
      avatarHue={app.stableHueFromSeed(key)}
      avatarUrl={avatarUrl}
      isFollowing={app.isFollowingByAddress[key]}
      onToggleFollow={() => app.toggleFollow(address)}
      onAdminSetPosterAllowed={async (allowed) => {
        if (!app.isOwner) return;
        if (!ethers.isAddress(address)) return;

        await runContractTx(allowed ? "Approve poster" : "Disapprove poster", async () => {
          const writeContract = await contract.getWriteContract();
          return (writeContract as any).setPosterAllowed(address, allowed);
        });

        setIsPosterAllowed(allowed);
        if (!allowed) setWasPosterDisapprovedEver(true);
      }}
      onAdminReset={async () => {
        if (!app.isOwner) return;
        const normalized = address.trim();
        if (!ethers.isAddress(normalized)) return;

        // Same behavior as Approvals modal: block, clear profile, burn posts.
        try {
          await runContractTx("Block poster", async () => {
            const writeContract = await contract.getWriteContract();
            return (writeContract as any).setPosterAllowed(normalized, false);
          });
        } catch {
          return;
        }

        setIsPosterAllowed(false);
        setWasPosterDisapprovedEver(true);

        try {
          await runContractTx("Clear profile", async () => {
            const writeContract = await contract.getWriteContract();
            return (writeContract as any).adminClearProfile(normalized);
          });
        } catch {
          // ignore
        }

        try {
          await app.loadProfile(normalized);
        } catch {
          // ignore
        }

        let tokenIds: bigint[] = [];
        try {
          const readContract = await contract.getReadContract();
          const runner: any = (readContract as any).runner;
          const provider: any = runner?.provider ?? runner;
          const latest = (await provider?.getBlockNumber?.()) ?? 0;

          const logs = (await (readContract as any).queryFilter(
            (readContract as any).filters.PostMinted(normalized),
            0,
            latest
          )) as any[];

          const uniq = new Set<string>();
          for (const l of logs) {
            const id = l?.args?.[1] as bigint | undefined;
            if (typeof id !== "bigint") continue;
            uniq.add(id.toString());
          }
          tokenIds = Array.from(uniq).map((s) => BigInt(s));
        } catch {
          tokenIds = [];
        }

        for (const tokenId of tokenIds) {
          try {
            await runContractTx(`Delete post #${tokenId.toString()}`, async () => {
              const writeContract = await contract.getWriteContract();
              return (writeContract as any).adminBurnPost(tokenId);
            });
          } catch {
            // continue
          }
        }

        try {
          await app.refreshFeed();
        } catch {
          // ignore
        }
      }}
      onAdminSetProfile={async (next) => {
        if (!app.isOwner) return;
        if (!ethers.isAddress(address)) return;

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

        await app.loadProfile(address);
      }}
      posts={filtered}
      chainId={app.chainId}
      status={app.status}
      isFeedLoading={app.isFeedLoading}
      walletAddress={app.walletAddress}
      authorIdentity={app.authorIdentity}
      editingTokenId={app.editingTokenId}
      editDraft={app.editDraft}
      isEditImageLoading={app.isEditImageLoading}
      tipDrafts={app.tipDrafts}
      commentDrafts={app.commentDrafts}
      onSetEditDraft={app.setEditDraft}
      onTipDraftChange={app.onTipDraftChange}
      onCommentDraftChange={app.onCommentDraftChange}
      onStartEditPost={app.startEditPost}
      onCancelEditPost={app.cancelEditPost}
      onSaveEditedPost={app.saveEditedPost}
      onEditSelectFile={app.onEditSelectFile}
      onEditClearImage={app.onEditClearImage}
      onAction={app.handleAction}
      onTip={app.handleTip}
      onBurn={app.burnPost}
      onFreezePost={app.freezePost}
      shortAddress={app.shortAddress}
      stableHueFromSeed={app.stableHueFromSeed}
      getNativeSymbol={app.getNativeSymbol}
      getExplorerTxUrl={app.getExplorerTxUrl}
    />
  );
}
