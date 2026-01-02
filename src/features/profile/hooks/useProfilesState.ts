import { useCallback, useEffect, useRef, useState } from "react";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { hasPinata } from "@features/ipfs";
import { getErrorMessage } from "@shared/lib/errors";
import { runInFlight } from "@shared/lib/inFlight";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { parseProfileTuple } from "./profilesState/parseProfileTuple";
import { readFileAsDataUrl } from "./profilesState/readFileAsDataUrl";
import { resetProfileUiState } from "./profilesState/resetProfileUiState";
import { resolveAvatarForSave } from "./profilesState/resolveAvatarForSave";
import { useEpochGuard } from "@shared/lib/epochGuard";
import { getEnv } from "@shared/lib/env";
import type { ChainProvider, ReadContractFactory, WriteContractFactory } from "@features/contract";

export type ProfileRecord = { name: string; bio: string; avatarUrl: string };

type UseProfilesStateArgs = {
  provider: ChainProvider | null;
  chainId: string | null;
  walletAddress: string | null;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;
  runContractTx: <T>(
    label: string,
    send: () => Promise<TransactionResponse>,
    onReceipt?: (receipt: TransactionReceipt) => Promise<T> | T
  ) => Promise<T | undefined>;
  setStatus: (msg: string) => void;
};

export function useProfilesState({
  provider,
  chainId,
  walletAddress,
  ensureContractDeployedOnCurrentNetwork,
  getReadContract,
  getWriteContract,
  runContractTx,
  setStatus
}: UseProfilesStateArgs) {
  const { bumpEpoch, snapshotEpoch, isStale } = useEpochGuard();
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

  const ipfsConfigured = hasPinata();

  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const isInitial = lastChainIdRef.current === undefined;
    if (chainId === lastChainIdRef.current) return;
    lastChainIdRef.current = chainId;

    if (isInitial) return;

    bumpEpoch();
    profilesByAddressRef.current = {};
    profileLoadInFlightRef.current = {};
    setProfilesByAddress({});

    resetProfileUiState({
      setProfileName,
      setProfileBio,
      setProfileAvatarUrl,
      setIsEditingProfile,
      setProfileDraftName,
      setProfileDraftBio,
      setProfileDraftAvatarUrl,
      setProfileDraftAvatarDataUrl,
      setProfileUploadedAvatarBlob,
      setProfileUploadedAvatarFilename,
      setIsProfileAvatarLoading
    });
  }, [chainId]);

  useEffect(() => {
    walletAddressRef.current = walletAddress;
    isEditingProfileRef.current = isEditingProfile;
  }, [walletAddress, isEditingProfile]);

  useEffect(() => {
    profilesByAddressRef.current = profilesByAddress;
  }, [profilesByAddress]);

  const loadProfile = useCallback(
    async (address: string) => {
      const key = address.toLowerCase();
      const epoch = snapshotEpoch();
      if (profilesByAddressRef.current[key]) return;

      await runInFlight(profileLoadInFlightRef.current, key, async () => {
        try {
          const env = getEnv();
          const chainIdNum = parseChainIdNumber(chainId);
          const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
          if (subgraphUrl) {
            try {
              const query = `
                query Profile($id: ID!) {
                  account(id: $id) {
                    name
                    bio
                    avatar
                  }
                }
              `;

              const result = await tryQuerySubgraph<{
                account: { name?: string | null; bio?: string | null; avatar?: string | null } | null;
              }>({
                url: subgraphUrl,
                query,
                variables: { id: key },
                timeoutMs: 10_000
              });

              if (result.ok) {
                const a = result.data?.account;
                const parsed = {
                  name: String(a?.name ?? ""),
                  bio: String(a?.bio ?? ""),
                  avatarUrl: String(a?.avatar ?? "")
                };

                if (isStale(epoch)) return;
                setProfilesByAddress((prev) => {
                  if (prev[key]) return prev;
                  return { ...prev, [key]: parsed };
                });

                const currentWalletAddress = walletAddressRef.current;
                const currentIsEditingProfile = isEditingProfileRef.current;
                if (currentWalletAddress && currentWalletAddress.toLowerCase() === key && !currentIsEditingProfile) {
                  if (isStale(epoch)) return;
                  setProfileName(parsed.name);
                  setProfileBio(parsed.bio);
                  setProfileAvatarUrl(parsed.avatarUrl);
                }

                return;
              }
            } catch {
              // fall back to on-chain read
            }
          }

          if (!provider) return;

          await ensureContractDeployedOnCurrentNetwork();
          const readContract = await getReadContract();
          const tuple = (await readContract.profileOf(address)) as
            | [string, string, string]
            | { name: string; bio: string; avatar: string };

          const parsed = parseProfileTuple(tuple);

          if (isStale(epoch)) return;
          setProfilesByAddress((prev) => {
            if (prev[key]) return prev;
            return { ...prev, [key]: parsed };
          });

          const currentWalletAddress = walletAddressRef.current;
          const currentIsEditingProfile = isEditingProfileRef.current;
          if (currentWalletAddress && currentWalletAddress.toLowerCase() === key && !currentIsEditingProfile) {
            if (isStale(epoch)) return;
            setProfileName(parsed.name);
            setProfileBio(parsed.bio);
            setProfileAvatarUrl(parsed.avatarUrl);
          }
        } catch {
          // ignore
        }
      });
    },
    [provider, chainId, ensureContractDeployedOnCurrentNetwork, getReadContract]
  );

  useEffect(() => {
    if (!walletAddress) {
      resetProfileUiState({
        setProfileName,
        setProfileBio,
        setProfileAvatarUrl,
        setIsEditingProfile,
        setProfileDraftName,
        setProfileDraftBio,
        setProfileDraftAvatarUrl,
        setProfileDraftAvatarDataUrl,
        setProfileUploadedAvatarBlob,
        setProfileUploadedAvatarFilename,
        setIsProfileAvatarLoading
      });
      return;
    }

    const key = walletAddress.toLowerCase();
    const existingProfile = profilesByAddress[key];
    if (existingProfile && !isEditingProfile) {
      setProfileName(existingProfile.name);
      setProfileBio(existingProfile.bio);
      setProfileAvatarUrl(existingProfile.avatarUrl);
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

      const dataUrl = await readFileAsDataUrl(file);

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
          avatar = await resolveAvatarForSave({
            ipfsConfigured,
            uploadedAvatarBlob: profileUploadedAvatarBlob,
            uploadedAvatarFilename: profileUploadedAvatarFilename,
            draftAvatarDataUrl: profileDraftAvatarDataUrl
          });
        } finally {
          setIsProfileAvatarLoading(false);
        }
      }

      const writeContract = await getWriteContract();
      await runContractTx("Save profile", () => writeContract.setProfile(name, bio, avatar));

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
