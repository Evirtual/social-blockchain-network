import type { Draft, Post, PostComment } from "../types";

export type AppContextValue = {
  // Theme
  theme: "light" | "dark";
  toggleTheme: () => void;

  // UI
  connectNudge: boolean;

  // Wallet + chain
  walletAddress: string | null;
  chainId: string | null;
  networkName: string | null;
  nativeBalance: string;
  contractDeployed: boolean | null;
  contractAddress: string | undefined;
  status: string;
  withdrawableTipsWei: bigint;

  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshWalletPanel: () => Promise<void>;
  withdrawTips: () => Promise<void>;

  // Feed loading
  isFeedLoading: boolean;

  // Composer
  isComposerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;
  ipfsConfigured: boolean;

  draft: Draft;
  isImageLoading: boolean;
  handleDraftChange: (field: keyof Draft, value: string) => void;
  onComposerImageUrlChange: (value: string) => void;
  onComposerClearImage: () => void;
  onSelectComposerFile: (file: File | null) => Promise<void>;
  mintPost: () => Promise<void>;

  approvalRequired: boolean;
  approvalRequested: boolean;
  requestApproval: () => Promise<void>;
  dismissApproval: () => void;

  // Feed + posts
  posts: Post[];
  refreshFeed: () => Promise<void>;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

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

  // Per-post UI state + actions
  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  tipDrafts: Record<string, string>;
  commentDrafts: Record<string, string>;

  setEditDraft: React.Dispatch<React.SetStateAction<Draft>>;

  onTipDraftChange: (tokenId: string, value: string) => void;
  onCommentDraftChange: (tokenId: string, value: string) => void;

  onEditSelectFile: (file: File | null) => Promise<void>;
  onEditClearImage: () => void;

  startEditPost: (post: Post) => void;
  cancelEditPost: () => void;
  saveEditedPost: () => Promise<void>;

  burnPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
  handleAction: (tokenId: string, action: "like" | "comment" | "share", postChainId?: string | null) => Promise<void>;
  handleTip: (tokenId: string, postChainId?: string | null) => Promise<void>;

  // Follow graph (cache)
  isFollowingByAddress: Record<string, boolean | undefined>;
  loadIsFollowing: (followee: string) => Promise<void>;
  toggleFollow: (followee: string) => Promise<void>;

  // Post admin actions
  freezePost: (tokenId: string, postChainId?: string | null) => Promise<void>;

  // Comments
  postComments: Record<string, PostComment[]>;
  isLoadingPostComments: Record<string, boolean>;
  loadCommentsForPost: (tokenId: string) => Promise<void>;

  // Reposts (shares)
  repostTokenIdsByAddress: Record<string, string[]>;
  isLoadingRepostsByAddress: Record<string, boolean>;
  loadRepostsForAddress: (address: string) => Promise<void>;

  // Likes
  likedTokenIdsByAddress: Record<string, string[]>;
  isLoadingLikesByAddress: Record<string, boolean>;
  loadLikesForAddress: (address: string) => Promise<void>;

  // Followers
  followerCountByAddress: Record<string, number>;
  isLoadingFollowerCountByAddress: Record<string, boolean>;
  loadFollowerCountForAddress: (address: string) => Promise<void>;

  // Followers + Following lists
  followersByAddress: Record<string, string[]>;
  isLoadingFollowersByAddress: Record<string, boolean>;
  loadFollowersForAddress: (address: string) => Promise<void>;

  followingByAddress: Record<string, string[]>;
  isLoadingFollowingByAddress: Record<string, boolean>;
  loadFollowingForAddress: (address: string) => Promise<void>;

  // Shared helpers
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;

  // Owner/admin UX
  isOwner: boolean;
};
