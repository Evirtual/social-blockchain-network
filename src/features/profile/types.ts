import type { Post } from "@types";
import type { PostActionsController } from "../post/types";
import type { useAccountPageProps } from "./hooks/useAccountPageProps";
import type { useProfilePageProps } from "./hooks/useProfilePageProps";

export type AccountPageProps = ReturnType<typeof useAccountPageProps>;
export type ProfilePageProps = ReturnType<typeof useProfilePageProps>;

export type ProfilePageViewModel = {
  accountPageProps: AccountPageProps;
  profilePageProps: ProfilePageProps;
  isSelf: boolean;
};

export type ProfilePageViewModelInput = {
  address: string;
  status: string;
  contractState: {
    isOwner: boolean;
    withdrawableTipsWei: bigint;
    withdrawFeeBps: number;
    protocolTreasuryAddress: string | null;
    treasuryWithdrawableTipsWei: bigint;
    treasuryNativeBalanceWei: bigint;
    contractAddress: string | undefined;
    contractDeployed: boolean | null;
  };
  walletState: {
    chainId: string | null;
    networkName: string | null;
    nativeBalance: string;
    walletAddress: string | null;
  };
  profileState: {
    displayName: string;
    profileBio: string;
    profileAvatarUrl: string;
    myPostsCount?: number;
    isEditingProfile: boolean;
    profileDraftName: string;
    profileDraftBio: string;
    profileDraftAvatarUrl: string;
    profileDraftAvatarDataUrl: string;
    isProfileAvatarLoading: boolean;
    isProfileSaving: boolean;
    selfAvatarHue: number;
    authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  };
  profileActions: {
    setProfileDraftName: (next: string) => void;
    setProfileDraftBio: (next: string) => void;
    onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
    onClearProfileAvatar: () => void;
    startEditProfile: () => void;
    cancelEditProfile: () => void;
  };
  follow: {
    followerCountByAddress: Record<string, number | undefined>;
    followersByAddress: Record<string, string[] | undefined>;
    followingByAddress: Record<string, string[] | undefined>;
    isLoadingFollowersByAddress: Record<string, boolean | undefined>;
    isLoadingFollowingByAddress: Record<string, boolean | undefined>;
    isFollowingByAddress: Record<string, boolean | undefined>;
  };
  feedState: {
    isFeedLoading: boolean;
  };
  admin: {
    isPosterAllowed: boolean | undefined;
    wasPosterDisapprovedEver: boolean | undefined;
  };
  handlers: {
    adminActionInFlight: "approve" | "disapprove" | "reset" | "save" | null;
    isFollowSubmitting: boolean;
    isWithdrawSubmitting: boolean;
    onDisconnectWallet: () => void;
    onWithdrawTips: () => Promise<void>;
    onSaveProfile: () => void;
    onToggleFollow: () => Promise<void>;
    onAdminSetPosterAllowed: (allowed: boolean) => Promise<void>;
    onAdminReset: () => Promise<void>;
    onAdminSetProfile: (next: {
      name: string;
      bio: string;
      avatarUrl: string;
      avatarFile?: File | null;
      avatarFilename?: string;
      avatarDataUrl?: string;
    }) => Promise<void>;
  };
  postActions: PostActionsController;
  data: {
    isSelf: boolean;
    name: string;
    bio: string;
    avatarUrl: string;
    filtered: Post[];
    savedPosts: Post[];
    likedPosts: Post[];
    selfKey: string;
    isLoadingSaved: boolean;
    isLoadingLiked: boolean;
  };
};
