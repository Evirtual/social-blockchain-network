import { createContext, useContext, useMemo } from "react";
import { useAuthorIdentity, usePrefetchMissingAuthorProfiles, useProfileDerived, useProfilesState } from "../../profile";
import { useContract } from "./ContractContext";
import { useFeed } from "./FeedContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";

export type ProfileContextValue = {
  // On-chain profiles (cache)
  profilesByAddress: Record<string, { name: string; bio: string; avatarUrl: string }>;
  loadProfile: (address: string) => Promise<void>;

  // Profile (self)
  profileName: string;
  profileBio: string;
  profileAvatarUrl: string;
  displayName: string;
  myPostsCount: number;
  isEditingProfile: boolean;
  profileDraftName: string;
  profileDraftBio: string;
  profileDraftAvatarUrl: string;
  profileDraftAvatarDataUrl: string;
  isProfileAvatarLoading: boolean;
  setProfileDraftName: (v: string) => void;
  setProfileDraftBio: (v: string) => void;
  setProfileDraftAvatarUrl: (v: string) => void;
  onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
  onClearProfileAvatar: () => void;
  startEditProfile: () => void;
  cancelEditProfile: () => void;
  saveProfile: () => Promise<void>;
  selfAvatarHue: number;
  profileLink: string | null;

  // Derived identity map for authors
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
};

const ProfileContext: ReturnType<typeof createContext<ProfileContextValue | null>> =
  ((globalThis as any).__sbnetProfileContext as ReturnType<typeof createContext<ProfileContextValue | null>> | undefined) ??
  (((globalThis as any).__sbnetProfileContext = createContext<ProfileContextValue | null>(null)) as ReturnType<
    typeof createContext<ProfileContextValue | null>
  >);

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

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within <ProfileProvider>");
  return ctx;
}
