import { useMemo } from "react";
import { useAuthorIdentity, usePrefetchMissingAuthorProfiles, useProfileDerived, useProfilesState } from "../../profile";
import { useContract } from "./ContractContext";
import { useFeed } from "./useFeed";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";
import { ProfileContext, type ProfileContextValue } from "./profileStateContext";

export type { ProfileContextValue } from "./profileStateContext";

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();
  const { posts } = useFeed();
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

  const value = useMemo<ProfileContextValue>(
    () => ({
      profilesByAddress,
      loadProfile,

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
      setProfileDraftName,
      setProfileDraftBio,
      setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile,
      onClearProfileAvatar,
      startEditProfile,
      cancelEditProfile,
      saveProfile,
      selfAvatarHue,
      profileLink,

      authorIdentity
    }),
    [
      profilesByAddress,
      loadProfile,
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
      startEditProfile,
      cancelEditProfile,
      saveProfile,
      selfAvatarHue,
      profileLink,
      authorIdentity,
      onSelectProfileAvatarFile,
      onClearProfileAvatar
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}


