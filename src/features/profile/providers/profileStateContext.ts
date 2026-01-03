import { createContext } from "react";
import { createStableContext } from "@shared/lib/createStableContext";

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
  isProfileSaving: boolean;
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
export const ProfileStateContext = createStableContext("__sbnetProfileStateContext", () =>
  createContext<ProfileState | null>(null)
);

export const ProfileActionsContext = createStableContext("__sbnetProfileActionsContext", () =>
  createContext<ProfileActions | null>(null)
);

export const ProfileContext = createStableContext("__sbnetProfileContext", () =>
  createContext<ProfileContextValue | null>(null)
);
