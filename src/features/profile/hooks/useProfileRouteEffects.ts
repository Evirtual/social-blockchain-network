import { useEffect, useRef } from "react";

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
  const loadProfileRef = useRef(args.loadProfile);
  const loadIsFollowingRef = useRef(args.loadIsFollowing);
  const loadSavedForAddressRef = useRef(args.loadSavedForAddress);
  const loadLikesForAddressRef = useRef(args.loadLikesForAddress);
  const loadFollowerCountForAddressRef = useRef(args.loadFollowerCountForAddress);
  const loadFollowersForAddressRef = useRef(args.loadFollowersForAddress);
  const loadFollowingForAddressRef = useRef(args.loadFollowingForAddress);

  useEffect(() => {
    loadProfileRef.current = args.loadProfile;
  }, [args.loadProfile]);

  useEffect(() => {
    loadIsFollowingRef.current = args.loadIsFollowing;
  }, [args.loadIsFollowing]);

  useEffect(() => {
    loadSavedForAddressRef.current = args.loadSavedForAddress;
  }, [args.loadSavedForAddress]);

  useEffect(() => {
    loadLikesForAddressRef.current = args.loadLikesForAddress;
  }, [args.loadLikesForAddress]);

  useEffect(() => {
    loadFollowerCountForAddressRef.current = args.loadFollowerCountForAddress;
  }, [args.loadFollowerCountForAddress]);

  useEffect(() => {
    loadFollowersForAddressRef.current = args.loadFollowersForAddress;
  }, [args.loadFollowersForAddress]);

  useEffect(() => {
    loadFollowingForAddressRef.current = args.loadFollowingForAddress;
  }, [args.loadFollowingForAddress]);

  useEffect(() => {
    void loadProfileRef.current(args.address);
  }, [args.address]);

  useEffect(() => {
    if (!args.walletAddress) return;
    if (args.isSelf) return;
    void loadIsFollowingRef.current(args.address);
  }, [args.address, args.walletAddress, args.isSelf]);

  useEffect(() => {
    if (!args.walletAddress) return;
    if (!args.isSelf) return;
    void loadSavedForAddressRef.current(args.address);
    void loadLikesForAddressRef.current(args.address);
  }, [args.address, args.walletAddress, args.isSelf]);

  useEffect(() => {
    if (!args.walletAddress) return;
    if (!args.isSelf) return;
    void loadFollowerCountForAddressRef.current(args.address);
    void loadFollowersForAddressRef.current(args.address);
    void loadFollowingForAddressRef.current(args.address);
  }, [args.address, args.walletAddress, args.isSelf]);
}
