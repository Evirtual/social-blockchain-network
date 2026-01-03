export function resetProfileUiState(setters: {
  setProfileName: (v: string) => void;
  setProfileBio: (v: string) => void;
  setProfileAvatarUrl: (v: string) => void;
  setIsEditingProfile: (v: boolean) => void;
  setProfileDraftName: (v: string) => void;
  setProfileDraftBio: (v: string) => void;
  setProfileDraftAvatarUrl: (v: string) => void;
  setProfileDraftAvatarDataUrl: (v: string) => void;
  setProfileUploadedAvatarBlob: (v: Blob | null) => void;
  setProfileUploadedAvatarFilename: (v: string) => void;
  setIsProfileAvatarLoading: (v: boolean) => void;
  setIsProfileSaving: (v: boolean) => void;
}) {
  setters.setProfileName("");
  setters.setProfileBio("");
  setters.setProfileAvatarUrl("");
  setters.setIsEditingProfile(false);
  setters.setProfileDraftName("");
  setters.setProfileDraftBio("");
  setters.setProfileDraftAvatarUrl("");
  setters.setProfileDraftAvatarDataUrl("");
  setters.setProfileUploadedAvatarBlob(null);
  setters.setProfileUploadedAvatarFilename("");
  setters.setIsProfileAvatarLoading(false);
  setters.setIsProfileSaving(false);
}
