import { useProfilePageViewModel } from "../hooks/useProfilePageViewModel";
import type { ProfilePageViewModel, ProfilePageViewModelInput } from "../types";

export function buildProfilePageViewModel(args: ProfilePageViewModelInput): ProfilePageViewModel {
  return useProfilePageViewModel(args);
}
