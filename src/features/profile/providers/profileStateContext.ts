import { createContext } from "react";

export type ProfileState = {
  // On-chain profiles
  profilesByAddress: Record<string, { name: string; bio: string; avatarUrl: string }>;

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
  selfAvatarHue: number;
  profileLink: string | null;

  // Derived identity map for authors
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
};

export type ProfileActions = {
  loadProfile: (address: string) => Promise<void>;
  setProfileDraftName: (v: string) => void;
  setProfileDraftBio: (v: string) => void;
  setProfileDraftAvatarUrl: (v: string) => void;
  onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
  onClearProfileAvatar: () => void;
  startEditProfile: () => void;
  cancelEditProfile: () => void;
  saveProfile: () => Promise<void>;
};

export type ProfileContextValue = ProfileState & ProfileActions;

// Keep the contexts stable across HMR updates.
export const ProfileStateContext: ReturnType<typeof createContext<ProfileState | null>> =
  (globalThis as { __sbnetProfileStateContext?: ReturnType<typeof createContext<ProfileState | null>> }).__sbnetProfileStateContext ??
  (((globalThis as { __sbnetProfileStateContext?: ReturnType<typeof createContext<ProfileState | null>> }).__sbnetProfileStateContext =
    createContext<ProfileState | null>(null)) as ReturnType<typeof createContext<ProfileState | null>>);

export const ProfileActionsContext: ReturnType<typeof createContext<ProfileActions | null>> =
  (globalThis as { __sbnetProfileActionsContext?: ReturnType<typeof createContext<ProfileActions | null>> }).__sbnetProfileActionsContext ??
  (((globalThis as { __sbnetProfileActionsContext?: ReturnType<typeof createContext<ProfileActions | null>> }).__sbnetProfileActionsContext =
    createContext<ProfileActions | null>(null)) as ReturnType<typeof createContext<ProfileActions | null>>);

export const ProfileContext: ReturnType<typeof createContext<ProfileContextValue | null>> =
  (globalThis as { __sbnetProfileContext?: ReturnType<typeof createContext<ProfileContextValue | null>> }).__sbnetProfileContext ??
  (((globalThis as { __sbnetProfileContext?: ReturnType<typeof createContext<ProfileContextValue | null>> }).__sbnetProfileContext =
    createContext<ProfileContextValue | null>(null)) as ReturnType<typeof createContext<ProfileContextValue | null>>);
