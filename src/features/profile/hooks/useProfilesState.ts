import { useCallback, useEffect, useRef, useState } from "react";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { bestEffortUnpinCids, extractIpfsCid, hasPinata } from "@features/ipfs";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { runInFlight } from "@shared/lib/inFlight";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { tryQuerySubgraph } from "@shared/lib/subgraphQuery";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { compressAvatarForIpfs } from "@shared/lib/avatarCompression";
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
  const MAX_AVATAR_URL_CHARS = 512;
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
  const [isProfileSaving, setIsProfileSaving] = useState(false);

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
      setIsProfileAvatarLoading,
      setIsProfileSaving
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
        setIsProfileAvatarLoading,
        setIsProfileSaving
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
      // Match post-media behavior: resize/compress avatars before pinning.
      // This keeps uploads small while maintaining crisp visual quality.
      if (file.type.startsWith("image/")) {
        const compressed = await compressAvatarForIpfs({ file, maxDim: 512, quality: 0.9 });
        if (compressed.ok) {
          setProfileUploadedAvatarBlob(compressed.blob);
          setProfileUploadedAvatarFilename(compressed.filename);
          setProfileDraftAvatarUrl("");
          setProfileDraftAvatarDataUrl(compressed.dataUrl);
          return;
        }
      }

      // Fallback: keep original bytes.
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
    if (isProfileSaving || isProfileAvatarLoading) return;
    setIsProfileSaving(true);
    let txSucceeded = false;
    let prevAvatarCid: string | null = null;
    let newAvatarCid: string | null = null;
    try {
      if (!walletAddress) return;

      const prevAvatarUrl = profileAvatarUrl;
      prevAvatarCid = extractIpfsCid(prevAvatarUrl);

      const name = profileDraftName.trim();
      const bio = profileDraftBio.trim();
      let avatar = profileDraftAvatarUrl.trim();

      if (profileUploadedAvatarBlob) {
        setIsProfileAvatarLoading(true);
        try {
          avatar = await resolveAvatarForSave({
            ipfsConfigured,
            account: walletAddress,
            chainId,
            uploadedAvatarBlob: profileUploadedAvatarBlob,
            uploadedAvatarFilename: profileUploadedAvatarFilename,
            draftAvatarDataUrl: profileDraftAvatarDataUrl
          });
          newAvatarCid = extractIpfsCid(avatar);
        } finally {
          setIsProfileAvatarLoading(false);
        }
      } else if (avatar.startsWith("data:image/")) {
        // Users sometimes paste base64 data URLs into the avatar URL field.
        // The contract caps avatar length (MAX_AVATAR_LENGTH=512), so we must
        // pin the image and store an ipfs:// URI (same idea as post media).
        if (!ipfsConfigured) {
          setStatus(
            "Avatar data URLs are too long for on-chain profile storage. Use the Upload button or provide an ipfs:// / https:// URL."
          );
          return;
        }

        setIsProfileAvatarLoading(true);
        try {
          const res = await fetch(avatar);
          const blob = await res.blob();
          if (blob.type.startsWith("image/")) {
            const fallbackName = "avatar";
            const synthetic = new File([blob], fallbackName, { type: blob.type });
            const compressed = await compressAvatarForIpfs({ file: synthetic, maxDim: 512, quality: 0.9 });
            if (compressed.ok) {
              avatar = await resolveAvatarForSave({
                ipfsConfigured,
                account: walletAddress,
                chainId,
                uploadedAvatarBlob: compressed.blob,
                uploadedAvatarFilename: compressed.filename,
                draftAvatarDataUrl: avatar
              });
              newAvatarCid = extractIpfsCid(avatar);
              return;
            }
          }

          avatar = await resolveAvatarForSave({
            ipfsConfigured,
            account: walletAddress,
            chainId,
            uploadedAvatarBlob: blob,
            uploadedAvatarFilename: "avatar",
            draftAvatarDataUrl: avatar
          });
          newAvatarCid = extractIpfsCid(avatar);
        } finally {
          setIsProfileAvatarLoading(false);
        }
      }

      if (avatar.length > MAX_AVATAR_URL_CHARS) {
        setStatus(
          `Avatar URL is too long (${avatar.length}/${MAX_AVATAR_URL_CHARS}). Use Upload (IPFS) or paste a shorter ipfs:// / https:// URL.`
        );
        return;
      }

      const writeContract = await getWriteContract();
      await runContractTx("Save profile", () => writeContract.setProfile(name, bio, avatar));
      txSucceeded = true;

      // Best-effort cleanup: if the user replaced/removed an IPFS avatar, unpin the previous CID.
      // We only do this after the tx succeeds so we don't delete content that is still referenced.
      if (ipfsConfigured && prevAvatarCid) {
        const nextCid = extractIpfsCid(avatar);
        if (!nextCid || nextCid !== prevAvatarCid) {
          const protect = new Set<string>();
          if (nextCid) protect.add(nextCid);
          await bestEffortUnpinCids([prevAvatarCid], { protectReferencedIn: protect });
        }
      }

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
      // If we pinned a new avatar but the tx failed, unpin it so we don't leak unused pins.
      // Only do this when the new CID differs from the previous avatar CID.
      try {
        if (!txSucceeded && ipfsConfigured) {
          const nextAvatarCid = newAvatarCid;
          if (nextAvatarCid && (!prevAvatarCid || nextAvatarCid !== prevAvatarCid)) {
            const protect = new Set<string>();
            if (prevAvatarCid) protect.add(prevAvatarCid);
            await bestEffortUnpinCids([nextAvatarCid], { protectReferencedIn: protect });
          }
        }
      } catch {
        // ignore
      }
      setStatusFromError(setStatus, error as ErrorInput);
    } finally {
      setIsProfileSaving(false);
    }
  }, [
    walletAddress,
    profileAvatarUrl,
    profileDraftName,
    profileDraftBio,
    profileDraftAvatarUrl,
    profileDraftAvatarDataUrl,
    profileUploadedAvatarBlob,
    profileUploadedAvatarFilename,
    isProfileAvatarLoading,
    isProfileSaving,
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
    isProfileSaving,

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
