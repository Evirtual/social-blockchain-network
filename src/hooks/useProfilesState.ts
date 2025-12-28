import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { hasPinata, pinataPinFile } from "../ipfs";
import { getErrorMessage } from "../lib/errors";
import { runInFlight } from "../lib/inFlight";

export type ProfileRecord = { name: string; bio: string; avatarUrl: string };

type UseProfilesStateArgs = {
  provider: unknown | null;
  walletAddress: string | null;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<unknown>;
  getWriteContract: () => Promise<unknown>;
  runContractTx: <T>(
    label: string,
    send: () => Promise<TransactionResponse>,
    onReceipt?: (receipt: TransactionReceipt) => Promise<T> | T
  ) => Promise<T | undefined>;
  setStatus: (msg: string) => void;
};

export function useProfilesState({
  provider,
  walletAddress,
  ensureContractDeployedOnCurrentNetwork,
  getReadContract,
  getWriteContract,
  runContractTx,
  setStatus
}: UseProfilesStateArgs) {
  const walletAddressRef = useRef<string | null>(null);
  const isEditingProfileRef = useRef(false);
  const profilesByAddressRef = useRef<Record<string, ProfileRecord>>({});

  const [profilesByAddress, setProfilesByAddress] = useState<Record<string, ProfileRecord>>({});
  const profileLoadInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const [profileName, setProfileName] = useState<string>("");
  const [profileBio, setProfileBio] = useState<string>("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>("");

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

  useEffect(() => {
    profilesByAddressRef.current = profilesByAddress;
  }, [profilesByAddress]);

  const loadProfile = useCallback(
    async (address: string) => {
      if (!provider) return;
      const key = address.toLowerCase();
      if (profilesByAddressRef.current[key]) return;

      await runInFlight(profileLoadInFlightRef.current, key, async () => {
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
      });
    },
    [
      provider,
      ensureContractDeployedOnCurrentNetwork,
      getReadContract
    ]
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
  }, [
    walletAddress,
    profileDraftName,
    profileDraftBio,
    profileDraftAvatarUrl,
    profileDraftAvatarDataUrl,
    profileUploadedAvatarBlob,
    profileUploadedAvatarFilename,
    ipfsConfigured,
    getWriteContract,
    runContractTx,
    setStatus
  ]);

  return {
    profilesByAddress,
    loadProfile,

    profileName,
    profileBio,
    profileAvatarUrl,

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
    saveProfile
  };
}
