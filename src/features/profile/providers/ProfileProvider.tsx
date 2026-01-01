import { useEffect, useMemo, useState } from "react";
import { useAuthorIdentity } from "../hooks/useAuthorIdentity";
import { usePrefetchMissingAuthorProfiles } from "../hooks/usePrefetchMissingAuthorProfiles";
import { useProfileDerived } from "../hooks/useProfileDerived";
import { useProfilesState } from "../hooks/useProfilesState";
import { useContractActions } from "@features/contract";
import { useFeedState } from "@features/feed";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";
import { useContractTx } from "@features/contract";
import { getSupportedNetworks } from "@features/home/services/supportedNetworks";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import {
  ProfileActionsContext,
  ProfileContext,
  ProfileStateContext,
  type ProfileActions,
  type ProfileContextValue,
  type ProfileState
} from "./profileStateContext";

export type { ProfileContextValue } from "./profileStateContext";

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId } = useWalletState();
  const { setStatus } = useStatusActions();
  const contract = useContractActions();
  const { posts } = useFeedState();
  const { runContractTx } = useContractTx();

  const getReadContract = contract.getReadContract;
  const getWriteContract = contract.getWriteContract;
  const ensureContractDeployedOnCurrentNetwork = contract.ensureContractDeployedOnCurrentNetwork;

  const {
    profilesByAddress,
    loadProfile,
    profileName,
    profileBio,
    profileAvatarUrl,
    isEditingProfile,
    profileDraftName,
    profileDraftBio,
    profileDraftAvatarUrl,
    profileDraftAvatarDataUrl,
    isProfileAvatarLoading,
    setProfileDraftName,
    setProfileDraftBio,
    setProfileDraftAvatarUrl,
    onSelectProfileAvatarFile,
    onClearProfileAvatar,
    startEditProfile,
    cancelEditProfile,
    saveProfile
  } = useProfilesState({
    provider,
    chainId,
    walletAddress,
    ensureContractDeployedOnCurrentNetwork,
    getReadContract,
    getWriteContract,
    runContractTx,
    setStatus
  });

  const { selfAvatarHue, displayName, myPostsCount, profileLink } = useProfileDerived({
    walletAddress,
    profileName,
    posts
  });
  const [myPostsCountFromSubgraph, setMyPostsCountFromSubgraph] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!walletAddress) {
      setMyPostsCountFromSubgraph(null);
      return () => {
        active = false;
      };
    }

    const env = import.meta.env as any;
    const supported = getSupportedNetworks().map((n) => String(n.chainId));
    const cacheKey = `socialBlockchainNetwork.profile.posts.${walletAddress.toLowerCase()}.${supported.slice().sort().join(",")}`;
    const cacheTtlMs = 5 * 60 * 1000;

    const load = async () => {
      if (typeof window !== "undefined") {
        try {
          const cachedRaw = window.sessionStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as { count?: number; ts?: number };
            if (
              typeof cached?.count === "number" &&
              typeof cached?.ts === "number" &&
              Date.now() - cached.ts < cacheTtlMs
            ) {
              if (active) setMyPostsCountFromSubgraph(cached.count);
              return;
            }
          }
        } catch {
          // Ignore cache read errors.
        }
      }

      let sum = 0;
      for (const id of supported) {
        const chainIdNum = Number(id);
        if (!Number.isFinite(chainIdNum)) continue;
        const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
        if (!subgraphUrl) continue;
        const result = await tryQuerySubgraph<{
          account: { postedCount?: string | null } | null;
        }>({
          url: subgraphUrl,
          query: `query AccountPosts($id: ID!) { account(id: $id) { postedCount } }`,
          variables: { id: walletAddress.toLowerCase() },
          timeoutMs: 8_000
        });
        if (!result.ok) continue;
        const count = Number(result.data?.account?.postedCount ?? 0);
        if (Number.isFinite(count)) sum += count;
      }
      if (active) setMyPostsCountFromSubgraph(sum);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify({ count: sum, ts: Date.now() }));
        } catch {
          // Ignore cache write errors.
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [walletAddress]);

  const authorIdentity = useAuthorIdentity(posts, profilesByAddress);

  usePrefetchMissingAuthorProfiles(Boolean(provider), posts, profilesByAddress, loadProfile, 4);

  const stateValue = useMemo<ProfileState>(
    () => ({
      profilesByAddress,
      profileName,
      profileBio,
      profileAvatarUrl,
      displayName,
      myPostsCount: myPostsCountFromSubgraph ?? 0,
      isEditingProfile,
      profileDraftName,
      profileDraftBio,
      profileDraftAvatarUrl,
      profileDraftAvatarDataUrl,
      isProfileAvatarLoading,
      selfAvatarHue,
      profileLink,
      authorIdentity
    }),
    [
      profilesByAddress,
      profileName,
      profileBio,
      profileAvatarUrl,
      displayName,
      myPostsCount,
      myPostsCountFromSubgraph,
      isEditingProfile,
      profileDraftName,
      profileDraftBio,
      profileDraftAvatarUrl,
      profileDraftAvatarDataUrl,
      isProfileAvatarLoading,
      selfAvatarHue,
      profileLink,
      authorIdentity
    ]
  );

  const actionsValue = useMemo<ProfileActions>(
    () => ({
      loadProfile,
      setProfileDraftName,
      setProfileDraftBio,
      setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile,
      onClearProfileAvatar,
      startEditProfile,
      cancelEditProfile,
      saveProfile
    }),
    [
      loadProfile,
      setProfileDraftName,
      setProfileDraftBio,
      setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile,
      onClearProfileAvatar,
      startEditProfile,
      cancelEditProfile,
      saveProfile
    ]
  );

  const value = useMemo<ProfileContextValue>(() => ({ ...stateValue, ...actionsValue }), [stateValue, actionsValue]);

  return (
    <ProfileStateContext.Provider value={stateValue}>
      <ProfileActionsContext.Provider value={actionsValue}>
        <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
      </ProfileActionsContext.Provider>
    </ProfileStateContext.Provider>
  );
}
