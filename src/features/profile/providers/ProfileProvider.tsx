import { useEffect, useMemo, useState } from "react";
import { useAuthorIdentity } from "../hooks/useAuthorIdentity";
import { usePrefetchMissingAuthorProfiles } from "../hooks/usePrefetchMissingAuthorProfiles";
import { useProfileDerived } from "../hooks/useProfileDerived";
import { useProfilesState } from "../hooks/useProfilesState";
import { useContractActionsFacade } from "@features/contract";
import { useFeedState } from "@features/feed";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";
import { getSupportedNetworks } from "@features/feed";
import { loadAccountCountsFromSubgraphs } from "@features/account/services/subgraph/loadAccountCounts";
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
  const contract = useContractActionsFacade();
  const feedState = useFeedState();
  const { posts } = feedState;
  const { runContractTx } = contract;

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
    isProfileSaving,
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
    // In demo mode we gate all subgraph reads until wallet is approved (live feed enabled).
    if (!walletAddress || !feedState.isLiveFeedEnabled) {
      setMyPostsCountFromSubgraph(null);
      return () => {
        active = false;
      };
    }

    const supported = getSupportedNetworks().map((n) => String(n.chainId));

    const load = async () => {
      const counts = await loadAccountCountsFromSubgraphs({ walletAddress, selectedChainIds: supported });
      if (active) setMyPostsCountFromSubgraph(counts.posted);
    };

    void load();

    return () => {
      active = false;
    };
  }, [walletAddress, feedState.isLiveFeedEnabled]);

  const authorIdentity = useAuthorIdentity(posts, profilesByAddress);

  usePrefetchMissingAuthorProfiles(Boolean(provider) && feedState.isLiveFeedEnabled, posts, profilesByAddress, loadProfile, 4);

  const resolvedMyPostsCount =
    myPostsCountFromSubgraph == null
      ? myPostsCount
      : feedState.isFeedLoading
        ? myPostsCountFromSubgraph
        : Math.min(myPostsCountFromSubgraph, myPostsCount);

  const stateValue = useMemo<ProfileState>(
    () => ({
      profilesByAddress,
      profileName,
      profileBio,
      profileAvatarUrl,
      displayName,
      myPostsCount: resolvedMyPostsCount,
      isEditingProfile,
      profileDraftName,
      profileDraftBio,
      profileDraftAvatarUrl,
      profileDraftAvatarDataUrl,
      isProfileAvatarLoading,
      isProfileSaving,
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
      resolvedMyPostsCount,
      isEditingProfile,
      profileDraftName,
      profileDraftBio,
      profileDraftAvatarUrl,
      profileDraftAvatarDataUrl,
      isProfileAvatarLoading,
      isProfileSaving,
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
