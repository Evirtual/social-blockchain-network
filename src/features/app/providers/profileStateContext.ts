import { createContext } from "react";

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

// Keep the context stable across HMR updates.
export const ProfileContext: ReturnType<typeof createContext<ProfileContextValue | null>> =
  ((globalThis as any).__sbnetProfileContext as
    | ReturnType<typeof createContext<ProfileContextValue | null>>
    | undefined) ??
  (((globalThis as any).__sbnetProfileContext = createContext<ProfileContextValue | null>(null)) as ReturnType<
    typeof createContext<ProfileContextValue | null>
  >);
