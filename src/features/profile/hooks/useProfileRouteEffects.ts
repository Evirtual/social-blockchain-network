import { useEffect } from "react";

export function useProfileRouteEffects(args: {
  address: string;
  isSelf: boolean;
  walletAddress: string | null;

  loadProfile: (address: string) => Promise<void>;

  loadIsFollowing: (address: string) => Promise<void>;

  loadSavedForAddress: (address: string) => Promise<void>;
  loadLikesForAddress: (address: string) => Promise<void>;

  loadFollowerCountForAddress: (address: string) => Promise<void>;
  loadFollowersForAddress: (address: string) => Promise<void>;
  loadFollowingForAddress: (address: string) => Promise<void>;
}) {
  useEffect(() => {
    void args.loadProfile(args.address);
  }, [args.address, args.loadProfile]);

  useEffect(() => {
    if (!args.walletAddress) return;
    if (args.isSelf) return;
    void args.loadIsFollowing(args.address);
  }, [args.address, args.walletAddress, args.isSelf, args.loadIsFollowing]);

  useEffect(() => {
    if (!args.walletAddress) return;
    if (!args.isSelf) return;
    void args.loadSavedForAddress(args.address);
    void args.loadLikesForAddress(args.address);
  }, [args.address, args.walletAddress, args.isSelf, args.loadLikesForAddress, args.loadSavedForAddress]);

  useEffect(() => {
    if (!args.walletAddress) return;
    if (!args.isSelf) return;
    void args.loadFollowerCountForAddress(args.address);
    void args.loadFollowersForAddress(args.address);
    void args.loadFollowingForAddress(args.address);
  }, [
    args.address,
    args.walletAddress,
    args.isSelf,
    args.loadFollowerCountForAddress,
    args.loadFollowersForAddress,
    args.loadFollowingForAddress
  ]);
}
