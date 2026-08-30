import { profileKey } from "../lib/profileKey";
import type { Post } from "@types";
import type { BrowserProvider } from "ethers";
import { useProfileRouteEffects } from "./useProfileRouteEffects";
import { useLikedPostsByAddress } from "./useLikedPostsByAddress";
import { useSavedPostsByAddress } from "./useSavedPostsByAddress";
import { useSelfSavedLikedPosts } from "./useSelfSavedLikedPosts";
import type { ReadContractFactory } from "@features/contract";
import { useNetworkFilterState, useSupportedNetworks } from "@features/feed";
import type { LoadPostsByTokenIdsResult } from "@features/feed/providers/feedStateContext";

export function useProfilePageData(args: {
  address: string;
  walletState: {
    provider: BrowserProvider | null;
    chainId: string | null;
    walletAddress: string | null;
  };
  contractState: {
    contractAddress: string | undefined;
  };
  contractActions: {
    ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
    getReadContract: ReadContractFactory;
  };
  feedState: {
    posts: Post[];
    isLiveFeedEnabled: boolean;
  };
  feedActions: {
    loadPostsByTokenIds: (tokenIds: string[], postChainId?: string | null) => Promise<LoadPostsByTokenIdsResult>;
  };
  profileState: {
    profilesByAddress: Record<string, { name?: string; bio?: string; avatarUrl?: string }>;
  };
  profileActions: {
    loadProfile: (address: string) => Promise<void>;
  };
  follow: {
    loadIsFollowing: (address: string) => Promise<void>;
    loadFollowerCountForAddress: (address: string) => Promise<void>;
    loadFollowersForAddress: (address: string) => Promise<void>;
    loadFollowingForAddress: (address: string) => Promise<void>;
  };
  setStatus: (next: string) => void;
}) {
  // The address identifies the account; the key only addresses the profile
  // cache. Comparing an address against the key silently never matches.
  const account = args.address.toLowerCase();
  const key = profileKey(args.walletState.chainId, args.address);
  const isSelf = !!args.walletState.walletAddress && args.walletState.walletAddress.toLowerCase() === account;
  const subgraphEnabled = Boolean(args.feedState.isLiveFeedEnabled);

  const loadPostsByTokenIds = (tokenIds: string[], postChainId?: string | null) =>
    args.feedActions.loadPostsByTokenIds(tokenIds, postChainId);

  const supportedNetworks = useSupportedNetworks();
  const { selectedNetworkChainIds } = useNetworkFilterState({
    searchQueryKey: "socialBlockchainNetwork.feed.searchQuery",
    selectedNetworksKey: "socialBlockchainNetwork.feed.selectedNetworks",
    walletAddress: args.walletState.walletAddress,
    chainId: args.walletState.chainId,
    supportedNetworks
  });

  const { likedTokenIdsByAddress, isLoadingLikesByAddress, loadLikesForAddress } = useLikedPostsByAddress({
    walletProvider: args.walletState.provider,
    chainId: args.walletState.chainId,
    selectedNetworkChainIds,
    contractAddress: args.contractState.contractAddress,
    ensureContractDeployedOnCurrentNetwork: args.contractActions.ensureContractDeployedOnCurrentNetwork,
    getReadContract: args.contractActions.getReadContract,
    loadPostsByTokenIds,
    setStatus: args.setStatus
  });

  const { savedTokenIdsByAddress, isLoadingSavedByAddress, loadSavedForAddress } = useSavedPostsByAddress({
    walletProvider: args.walletState.provider,
    chainId: args.walletState.chainId,
    selectedNetworkChainIds,
    contractAddress: args.contractState.contractAddress,
    ensureContractDeployedOnCurrentNetwork: args.contractActions.ensureContractDeployedOnCurrentNetwork,
    getReadContract: args.contractActions.getReadContract,
    loadPostsByTokenIds,
    setStatus: args.setStatus
  });

  useProfileRouteEffects({
    address: args.address,
    isSelf,
    enabled: subgraphEnabled,
    walletAddress: args.walletState.walletAddress,
    loadProfile: args.profileActions.loadProfile,
    loadIsFollowing: args.follow.loadIsFollowing,
    loadSavedForAddress,
    loadLikesForAddress,
    loadFollowerCountForAddress: args.follow.loadFollowerCountForAddress,
    loadFollowersForAddress: args.follow.loadFollowersForAddress,
    loadFollowingForAddress: args.follow.loadFollowingForAddress
  });

  const profile = args.profileState.profilesByAddress[key];
  const name = profile?.name ?? "";
  const bio = profile?.bio ?? "";
  const avatarUrl = profile?.avatarUrl ?? "";

  const filtered = args.feedState.posts.filter((p) => p.author?.toLowerCase() === account);

  const { savedPosts, likedPosts } = useSelfSavedLikedPosts({
    isSelf,
    walletAddress: args.walletState.walletAddress,
    feedPosts: args.feedState.posts,
    savedTokenIdsByAddress,
    likedTokenIdsByAddress
  });

  const selfKey = args.walletState.walletAddress?.toLowerCase() ?? "";

  return {
    key,
    isSelf,
    name,
    bio,
    avatarUrl,
    filtered,
    savedPosts,
    likedPosts,
    selfKey,
    isLoadingSaved: !!(selfKey && isLoadingSavedByAddress[selfKey]),
    isLoadingLiked: !!(selfKey && isLoadingLikesByAddress[selfKey])
  };
}
