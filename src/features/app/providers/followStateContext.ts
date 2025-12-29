import { createContext } from "react";

export type FollowContextValue = {
  // Follow graph (cache)
  isFollowingByAddress: Record<string, boolean | undefined>;
  loadIsFollowing: (followee: string) => Promise<void>;
  toggleFollow: (followee: string) => Promise<void>;

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
};

// Keep the context stable across HMR updates.
export const FollowContext: ReturnType<typeof createContext<FollowContextValue | null>> =
  ((globalThis as any).__sbnetFollowContext as ReturnType<typeof createContext<FollowContextValue | null>> | undefined) ??
  (((globalThis as any).__sbnetFollowContext = createContext<FollowContextValue | null>(null)) as ReturnType<
    typeof createContext<FollowContextValue | null>
  >);
