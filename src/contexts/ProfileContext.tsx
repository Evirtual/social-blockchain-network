import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { pinataPinFile } from "../ipfs";
import { getErrorMessage } from "../lib/errors";
import { shortAddress, stableHueFromSeed } from "../lib/format";
import { useContract } from "./ContractContext";
import { useFeed } from "./FeedContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";
import { hasPinata } from "../ipfs";

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

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();
  const { posts } = useFeed();
  const { runContractTx } = useContractTx();

  const walletAddressRef = useRef<string | null>(null);
  const isEditingProfileRef = useRef(false);

  const getReadContract = contract.getReadContract;
  const getWriteContract = contract.getWriteContract;
  const ensureContractDeployedOnCurrentNetwork = contract.ensureContractDeployedOnCurrentNetwork;

  const [profileName, setProfileName] = useState<string>("");
  const [profileBio, setProfileBio] = useState<string>("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>("");

  const [profilesByAddress, setProfilesByAddress] = useState<
    Record<string, { name: string; bio: string; avatarUrl: string }>
  >({});

  const profileLoadInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraftName, setProfileDraftName] = useState<string>("");
  const [profileDraftBio, setProfileDraftBio] = useState<string>("");
  const [profileDraftAvatarUrl, setProfileDraftAvatarUrl] = useState<string>("");
  const [profileDraftAvatarDataUrl, setProfileDraftAvatarDataUrl] = useState<string>("");
  const [profileUploadedAvatarBlob, setProfileUploadedAvatarBlob] = useState<Blob | null>(null);
  const [profileUploadedAvatarFilename, setProfileUploadedAvatarFilename] = useState<string>("");
  const [isProfileAvatarLoading, setIsProfileAvatarLoading] = useState(false);

  const ipfsConfigured = useMemo(() => hasPinata(), []);

  useEffect(() => {
    walletAddressRef.current = walletAddress;
    isEditingProfileRef.current = isEditingProfile;
  }, [walletAddress, isEditingProfile]);

  const loadProfile = useCallback(
    async (address: string) => {
      if (!provider) return;
      const key = address.toLowerCase();
      if (profilesByAddress[key]) return;

      const existing = profileLoadInFlightRef.current[key];
      if (existing) {
        await existing;
        return;
      }

      const task = (async () => {
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();
          const tuple = (await (readContract as any).profileOf(address)) as
            | [string, string, string]
            | { name: string; bio: string; avatar: string };

          const name = Array.isArray(tuple) ? tuple[0] : (tuple?.name ?? "");
          const bio = Array.isArray(tuple) ? tuple[1] : (tuple?.bio ?? "");
          const avatar = Array.isArray(tuple) ? tuple[2] : (tuple?.avatar ?? "");

          setProfilesByAddress((prev) => {
            if (prev[key]) return prev;
            return { ...prev, [key]: { name: name || "", bio: bio || "", avatarUrl: avatar || "" } };
          });

          const currentWalletAddress = walletAddressRef.current;
          const currentIsEditingProfile = isEditingProfileRef.current;
          if (currentWalletAddress && currentWalletAddress.toLowerCase() === key && !currentIsEditingProfile) {
            setProfileName(name || "");
            setProfileBio(bio || "");
            setProfileAvatarUrl(avatar || "");
          }
        } catch {
          // ignore
        }
      })();

      profileLoadInFlightRef.current[key] = task;
      try {
        await task;
      } finally {
        if (profileLoadInFlightRef.current[key] === task) {
          profileLoadInFlightRef.current[key] = null;
        }
      }
    },
    [provider, profilesByAddress, ensureContractDeployedOnCurrentNetwork, getReadContract, walletAddress, isEditingProfile]
  );

  useEffect(() => {
    if (!walletAddress) {
      setProfileName("");
      setProfileBio("");
      setProfileAvatarUrl("");
      setIsEditingProfile(false);
      setProfileDraftName("");
      setProfileDraftBio("");
      setProfileDraftAvatarUrl("");
      setProfileDraftAvatarDataUrl("");
      setProfileUploadedAvatarBlob(null);
      setProfileUploadedAvatarFilename("");
      setIsProfileAvatarLoading(false);
      return;
    }

    const key = walletAddress.toLowerCase();
    const cached = profilesByAddress[key];
    if (cached && !isEditingProfile) {
      setProfileName(cached.name);
      setProfileBio(cached.bio);
      setProfileAvatarUrl(cached.avatarUrl);
    }

    void loadProfile(walletAddress);
  }, [walletAddress, loadProfile, profilesByAddress, isEditingProfile]);

  const onSelectProfileAvatarFile = useCallback(async (file: File | null) => {
    if (!file) {
      setProfileUploadedAvatarBlob(null);
      setProfileUploadedAvatarFilename("");
      setProfileDraftAvatarDataUrl("");
      return;
    }

    setIsProfileAvatarLoading(true);
    try {
      setProfileUploadedAvatarBlob(file);
      setProfileUploadedAvatarFilename(file.name || "avatar.png");

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });

      setProfileDraftAvatarUrl("");
      setProfileDraftAvatarDataUrl(dataUrl);
    } finally {
      setIsProfileAvatarLoading(false);
    }
  }, []);

  const onClearProfileAvatar = useCallback(() => {
    setProfileDraftAvatarUrl("");
    setProfileDraftAvatarDataUrl("");
    setProfileUploadedAvatarBlob(null);
    setProfileUploadedAvatarFilename("");
  }, []);

  const saveProfile = useCallback(async () => {
    try {
      if (!walletAddress) return;

      const name = profileDraftName.trim();
      const bio = profileDraftBio.trim();
      let avatar = profileDraftAvatarUrl.trim();

      if (profileUploadedAvatarBlob) {
        setIsProfileAvatarLoading(true);
        try {
          if (ipfsConfigured) {
            const pinned = await pinataPinFile(profileUploadedAvatarBlob, profileUploadedAvatarFilename);
            avatar = `ipfs://${pinned.IpfsHash}`;
          } else {
            avatar = profileDraftAvatarDataUrl || "";
          }
        } finally {
          setIsProfileAvatarLoading(false);
        }
      }

      const writeContract = await getWriteContract();
      await runContractTx("Save profile", () => (writeContract as any).setProfile(name, bio, avatar));

      const key = walletAddress.toLowerCase();
      setProfilesByAddress((prev) => ({ ...prev, [key]: { name, bio, avatarUrl: avatar } }));
      setProfileName(name);
      setProfileBio(bio);
      setProfileAvatarUrl(avatar);
      setIsEditingProfile(false);
      setProfileUploadedAvatarBlob(null);
      setProfileUploadedAvatarFilename("");
      setProfileDraftAvatarDataUrl("");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }, [walletAddress, profileDraftName, profileDraftBio, profileDraftAvatarUrl, profileDraftAvatarDataUrl, profileUploadedAvatarBlob, profileUploadedAvatarFilename, ipfsConfigured, getWriteContract, runContractTx, setStatus]);

  const startEditProfile = useCallback(() => {
    setProfileDraftName(profileName);
    setProfileDraftBio(profileBio);
    setProfileDraftAvatarUrl(profileAvatarUrl);
    setProfileDraftAvatarDataUrl("");
    setProfileUploadedAvatarBlob(null);
    setProfileUploadedAvatarFilename("");
    setIsEditingProfile(true);
  }, [profileName, profileBio, profileAvatarUrl]);

  const cancelEditProfile = useCallback(() => {
    setIsEditingProfile(false);
    setProfileDraftName(profileName);
    setProfileDraftBio(profileBio);
    setProfileDraftAvatarUrl(profileAvatarUrl);
    setProfileDraftAvatarDataUrl("");
    setProfileUploadedAvatarBlob(null);
    setProfileUploadedAvatarFilename("");
  }, [profileName, profileBio, profileAvatarUrl]);

  const selfAvatarSeed = walletAddress ? walletAddress.toLowerCase() : "guest";
  const selfAvatarHue = useMemo(() => stableHueFromSeed(selfAvatarSeed), [selfAvatarSeed]);

  const displayName = profileName.trim() || (walletAddress ? shortAddress(walletAddress) : "Guest");

  const myPostsCount = useMemo(() => {
    if (!walletAddress) return 0;
    const key = walletAddress.toLowerCase();
    return posts.filter((p) => p.author?.toLowerCase() === key).length;
  }, [posts, walletAddress]);

  const authorIdentity = useMemo(() => {
    const map = new Map<string, { name: string; hue: number; avatarUrl?: string }>();
    for (const post of posts) {
      if (!post.author) continue;
      const key = post.author.toLowerCase();
      if (map.has(key)) continue;
      const p = profilesByAddress[key];
      const name = p?.name ?? "";
      const avatarUrl = p?.avatarUrl?.trim() ? p.avatarUrl : undefined;
      map.set(key, { name, hue: stableHueFromSeed(key), avatarUrl });
    }
    return map;
  }, [posts, profilesByAddress]);

  // When new posts appear, opportunistically fetch missing author profiles.
  useEffect(() => {
    if (!provider) return;
    const uniqueAuthors = Array.from(new Set(posts.map((p) => (p.author ? p.author.toLowerCase() : "")).filter(Boolean)));
    if (uniqueAuthors.length === 0) return;

    const missing = uniqueAuthors.filter((a) => !profilesByAddress[a]);
    if (missing.length === 0) return;

    const task = async () => {
      const limit = 4;
      let next = 0;
      const workers = Array.from({ length: Math.min(limit, missing.length) }, async () => {
        while (true) {
          const i = next++;
          if (i >= missing.length) break;
          await loadProfile(missing[i]);
        }
      });
      await Promise.all(workers);
    };

    void task();
  }, [provider, posts, profilesByAddress, loadProfile]);

  const profileLink = walletAddress ? `/profile/${walletAddress}` : null;

  const value = useMemo<ProfileContextValue>(
    () => ({
      profilesByAddress,
      loadProfile,

      profileName,
      profileBio,
      profileAvatarUrl,
      displayName,
      myPostsCount,
      isEditingProfile,
      profileDraftName,
      profileDraftBio,
      profileDraftAvatarUrl,
      profileDraftAvatarDataUrl,
      isProfileAvatarLoading,
      setProfileDraftName,
      setProfileDraftBio,
      setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile,
      onClearProfileAvatar,
      startEditProfile,
      cancelEditProfile,
      saveProfile,
      selfAvatarHue,
      profileLink,

      authorIdentity
    }),
    [
      profilesByAddress,
      loadProfile,
      profileName,
      profileBio,
      profileAvatarUrl,
      displayName,
      myPostsCount,
      isEditingProfile,
      profileDraftName,
      profileDraftBio,
      profileDraftAvatarUrl,
      profileDraftAvatarDataUrl,
      isProfileAvatarLoading,
      startEditProfile,
      cancelEditProfile,
      saveProfile,
      selfAvatarHue,
      profileLink,
      authorIdentity,
      onSelectProfileAvatarFile,
      onClearProfileAvatar
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within <ProfileProvider>");
  return ctx;
}
