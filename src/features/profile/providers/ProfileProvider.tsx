import { useEffect, useMemo, useState } from "react";
import { useAuthorIdentity } from "../hooks/useAuthorIdentity";
import { usePrefetchMissingAuthorProfiles } from "../hooks/usePrefetchMissingAuthorProfiles";
import { useProfileDerived } from "../hooks/useProfileDerived";
import { useProfilesState } from "../hooks/useProfilesState";
import { useContractActionsFacade } from "@features/contract/hooks/useContractActionsFacade";
import { useFeedState } from "@features/feed/providers/useFeedState";
import { useStatusActions } from "@features/status/providers/StatusProvider";
import { useWalletState } from "@features/wallet/providers/useWalletState";
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
    chainId,
    profileName,
    posts
  });
  const [myPostsCountFromSubgraph, setMyPostsCountFromSubgraph] = useState<number | null>(null);

  useEffect(() => {
    let active = true;    if (!walletAddress) {
      setMyPostsCountFromSubgraph(null);
      return () => {
        active = false;
      };
    }

    // Scoped to the chain in the wallet, because that is the chain the feed is
    // pinned to while connected. Counting every supported network here made the
    // card read 9 while three posts were on screen, until the feed finished
    // loading and the number dropped to 3.
    const chainKey = String(chainId ?? "").trim();
    if (!chainKey) {
      setMyPostsCountFromSubgraph(null);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      const counts = await loadAccountCountsFromSubgraphs({ walletAddress, selectedChainIds: [chainKey] });
      if (active) setMyPostsCountFromSubgraph(counts.posted);
    };

    void load();

    return () => {
      active = false;
    };
  }, [walletAddress, chainId]);

  const authorIdentity = useAuthorIdentity(posts, profilesByAddress);

  // Author profiles are read from the subgraph, not through the wallet, so
  // they resolve for visitors who have not connected one.
  usePrefetchMissingAuthorProfiles(true, posts, profilesByAddress, loadProfile, 4);

  // Both numbers now describe the same chain, so the subgraph count simply
  // stands in until the feed has loaded rather than being clamped against it.
  const resolvedMyPostsCount =
    myPostsCountFromSubgraph == null || !feedState.isFeedLoading ? myPostsCount : myPostsCountFromSubgraph;

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
