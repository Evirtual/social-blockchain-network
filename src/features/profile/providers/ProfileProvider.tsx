import { useMemo } from "react";
import { useAuthorIdentity } from "../hooks/useAuthorIdentity";
import { usePrefetchMissingAuthorProfiles } from "../hooks/usePrefetchMissingAuthorProfiles";
import { useProfileDerived } from "../hooks/useProfileDerived";
import { useProfilesState } from "../hooks/useProfilesState";
import { useContractActions } from "@features/contract";
import { useFeedState } from "@features/feed";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";
import { useContractTx } from "@features/app/providers/useContractTx";
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

  const { selfAvatarHue, displayName, myPostsCount, profileLink } = useProfileDerived({ walletAddress, profileName, posts });

  const authorIdentity = useAuthorIdentity(posts, profilesByAddress);

  usePrefetchMissingAuthorProfiles(Boolean(provider), posts, profilesByAddress, loadProfile, 4);

  const stateValue = useMemo<ProfileState>(
    () => ({
      profilesByAddress,
      profileName,
      profileBio,
      profileAvatarUrl,
      displayName,
      myPostsCount,
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
