import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { hasPinata, pinataPinFile, pinataPinJson } from "../ipfs";
import type { Draft, Post, PostComment } from "../types";
import { getSocialContract, socialInterface } from "../contracts/socialPosts";
import { getExplorerTxUrl, getNativeSymbol } from "../lib/chain";
import { getErrorMessage } from "../lib/errors";
import { shortAddress, stableHueFromSeed } from "../lib/format";
import { createMetadataUri, fetchTokenMetadata } from "../lib/metadata";
import { isUserRejectedTx, useTxNotifications } from "./TxNotificationsContext";

const LEGACY_CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;
const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";
const CONTRACT_ADDRESS_BY_CHAIN_ID: Record<number, string | undefined> = {
  // Ethereum
  1: import.meta.env.VITE_CONTRACT_ADDRESS_ETH as string | undefined,
  11155111: import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA as string | undefined,

  // Base
  8453: import.meta.env.VITE_CONTRACT_ADDRESS_BASE as string | undefined,
  84532: import.meta.env.VITE_CONTRACT_ADDRESS_BASE_SEPOLIA as string | undefined,

  // BNB Smart Chain (BSC)
  56: import.meta.env.VITE_CONTRACT_ADDRESS_BSC as string | undefined,
  97: import.meta.env.VITE_CONTRACT_ADDRESS_BSC_TESTNET as string | undefined
};

const RPC_URL_BY_CHAIN_ID: Record<number, string | undefined> = {
  // Ethereum
  1: import.meta.env.VITE_RPC_URL_ETH as string | undefined,
  11155111: import.meta.env.VITE_RPC_URL_SEPOLIA as string | undefined,

  // Base
  8453: import.meta.env.VITE_RPC_URL_BASE as string | undefined,
  84532: import.meta.env.VITE_RPC_URL_BASE_SEPOLIA as string | undefined,

  // BNB Smart Chain (BSC)
  56: import.meta.env.VITE_RPC_URL_BSC as string | undefined,
  97: import.meta.env.VITE_RPC_URL_BSC_TESTNET as string | undefined
};

function chainIdToNumber(chainId: string | null): number | null {
  if (!chainId) return null;
  if (chainId.startsWith("0x") || chainId.startsWith("0X")) {
    const n = Number.parseInt(chainId, 16);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number.parseInt(chainId, 10);
  return Number.isFinite(n) ? n : null;
}

function resolveContractAddress(chainIdNumber: number | null): string | undefined {
  if (typeof chainIdNumber === "number") {
    const mapped = CONTRACT_ADDRESS_BY_CHAIN_ID[chainIdNumber];
    if (mapped) return mapped;
  }
  return LEGACY_CONTRACT_ADDRESS;
}

export type AppContextValue = {
  // Theme
  theme: "light" | "dark";
  toggleTheme: () => void;

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
  handleAction: (tokenId: string, action: "like" | "comment", postChainId?: string | null) => Promise<void>;
  handleTip: (tokenId: string, postChainId?: string | null) => Promise<void>;

  // Comments
  postComments: Record<string, PostComment[]>;
  isLoadingPostComments: Record<string, boolean>;
  loadCommentsForPost: (tokenId: string) => Promise<void>;

  // Shared helpers
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const txNotifications = useTxNotifications();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const stored =
        localStorage.getItem("socialBlockchainNetwork.theme") ?? localStorage.getItem("mintedSocial.theme");
      if (stored === "light" || stored === "dark") return stored;
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string>("—");
  const [contractDeployed, setContractDeployed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string>("Wallet disconnected");

  const [draft, setDraft] = useState<Draft>({
    title: "",
    body: "",
    imageUrl: "",
    imageDataUrl: ""
  });
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [uploadedImageBlob, setUploadedImageBlob] = useState<Blob | null>(null);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<string>("");

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

  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({
    title: "",
    body: "",
    imageUrl: "",
    imageDataUrl: ""
  });
  const [editUploadedImageBlob, setEditUploadedImageBlob] = useState<Blob | null>(null);
  const [editUploadedImageFilename, setEditUploadedImageFilename] = useState<string>("");
  const [isEditImageLoading, setIsEditImageLoading] = useState(false);

  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const [withdrawableTipsWei, setWithdrawableTipsWei] = useState<bigint>(0n);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(false);

  // Ethers BrowserProvider caches network info. When the wallet network changes,
  // recreate the provider so reads use the new chain immediately.
  const [providerNonce, setProviderNonce] = useState<number>(0);

  const [isWalletAutoConnectDisabled, setIsWalletAutoConnectDisabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WALLET_DISCONNECTED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [isLoadingPostComments, setIsLoadingPostComments] = useState<Record<string, boolean>>({});

  const refreshFeedInFlightRef = useRef<Promise<void> | null>(null);
  const refreshWalletInFlightRef = useRef<Promise<void> | null>(null);
  const commentsInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const chainIdNumberRef = useRef<number | null>(null);

  const ipfsConfigured = useMemo(() => hasPinata(), []);

  const provider = useMemo(() => {
    const ethereum = window.ethereum as ethers.Eip1193Provider | undefined;
    if (!ethereum) return null;
    return new ethers.BrowserProvider(ethereum);
  }, [providerNonce]);

  const contractAddressForChain = useMemo(() => {
    const chain = chainIdToNumber(chainId);
    return resolveContractAddress(chain ?? chainIdNumberRef.current);
  }, [chainId]);

  const requireContractAddress = useCallback(() => {
    const chain = chainIdToNumber(chainId) ?? chainIdNumberRef.current;
    const resolved = resolveContractAddress(chain);
    if (resolved) return resolved;

    const chainHint = typeof chain === "number" ? ` (chainId ${chain})` : "";

    throw new Error(
      `Missing contract address${chainHint}. Set it in your environment (e.g. .env.local).\n\n` +
        `For multi-network: set VITE_CONTRACT_ADDRESS_ETH (1) and/or VITE_CONTRACT_ADDRESS_BASE (8453).\n` +
        "For local dev: run npm run deploy:local then restart the dev server."
    );
  }, [chainId]);

  const getSigner = async () => {
    if (!provider) throw new Error("Wallet not found.");
    return provider.getSigner();
  };

  const ensureContractDeployedOnCurrentNetwork = useCallback(async () => {
    if (!provider) throw new Error("Wallet not found.");
    const address = requireContractAddress();
    const code = await provider.getCode(address);
    if (!code || code === "0x") {
      setContractDeployed(false);
      throw new Error(
        "Contract not found on this network. Switch your wallet network (e.g. Localhost 8545 / chainId 31337) or deploy the contract to the current chain."
      );
    }
    setContractDeployed(true);
  }, [provider, requireContractAddress]);

  const getContract = async () => {
    const signer = await getSigner();
    const address = requireContractAddress();
    return getSocialContract(address, signer);
  };

  const getReadContract = async () => {
    if (!provider) throw new Error("Wallet not found.");
    const address = requireContractAddress();
    return getSocialContract(address, provider);
  };

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("socialBlockchainNetwork.theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

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

          if (walletAddress && walletAddress.toLowerCase() === key && !isEditingProfile) {
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
    [provider, ensureContractDeployedOnCurrentNetwork, walletAddress, isEditingProfile, profilesByAddress]
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

    // Prefer cached value immediately.
    const key = walletAddress.toLowerCase();
    const cached = profilesByAddress[key];
    if (cached && !isEditingProfile) {
      setProfileName(cached.name);
      setProfileBio(cached.bio);
      setProfileAvatarUrl(cached.avatarUrl);
    }

    void loadProfile(walletAddress);
  }, [walletAddress, loadProfile, profilesByAddress, isEditingProfile]);

  const onSelectProfileAvatarFile = async (file: File | null) => {
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
  };

  const onClearProfileAvatar = () => {
    setProfileDraftAvatarUrl("");
    setProfileDraftAvatarDataUrl("");
    setProfileUploadedAvatarBlob(null);
    setProfileUploadedAvatarFilename("");
  };

  const saveProfile = async () => {
    if (!walletAddress) return;
    const name = profileDraftName.trim();
    const bio = profileDraftBio.trim();

    let avatar = profileDraftAvatarUrl.trim();

    if (profileUploadedAvatarBlob) {
      setIsProfileAvatarLoading(true);
      try {
        if (ipfsConfigured) {
          const pinned = await pinataPinFile(profileUploadedAvatarBlob, profileUploadedAvatarFilename || "avatar.png");
          avatar = `ipfs://${pinned.IpfsHash}`;
        } else {
          avatar = profileDraftAvatarDataUrl || "";
        }
      } finally {
        setIsProfileAvatarLoading(false);
      }
    }

    const contract = await getContract();
    await runContractTx("Save profile", () => (contract as any).setProfile(name, bio, avatar));

    const key = walletAddress.toLowerCase();
    setProfilesByAddress((prev) => ({ ...prev, [key]: { name, bio, avatarUrl: avatar } }));
    setProfileName(name);
    setProfileBio(bio);
    setProfileAvatarUrl(avatar);
    setIsEditingProfile(false);
    setProfileUploadedAvatarBlob(null);
    setProfileUploadedAvatarFilename("");
    setProfileDraftAvatarDataUrl("");
  };

  const startEditProfile = () => {
    setProfileDraftName(profileName);
    setProfileDraftBio(profileBio);
    setProfileDraftAvatarUrl(profileAvatarUrl);
    setProfileDraftAvatarDataUrl("");
    setProfileUploadedAvatarBlob(null);
    setProfileUploadedAvatarFilename("");
    setIsEditingProfile(true);
  };

  const cancelEditProfile = () => {
    setIsEditingProfile(false);
    setProfileDraftName(profileName);
    setProfileDraftBio(profileBio);
    setProfileDraftAvatarUrl(profileAvatarUrl);
    setProfileDraftAvatarDataUrl("");
    setProfileUploadedAvatarBlob(null);
    setProfileUploadedAvatarFilename("");
  };

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

  useEffect(() => {
    if (!provider) return;
    if (!contractAddressForChain) return;
    const uniqueAuthors = Array.from(
      new Set(posts.map((p) => (p.author ? p.author.toLowerCase() : "")).filter(Boolean))
    );
    if (uniqueAuthors.length === 0) return;

    const missing = uniqueAuthors.filter((a) => !profilesByAddress[a]);
    if (missing.length === 0) return;

    const task = async () => {
      // light concurrency to avoid spiking RPC
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
  }, [provider, posts, profilesByAddress, loadProfile, contractAddressForChain]);

  const loadCommentsForPost = useCallback(
    async (tokenId: string) => {
      if (!provider) return;

      const existingInFlight = commentsInFlightRef.current[tokenId];
      if (existingInFlight) {
        await existingInFlight;
        return;
      }

      const address = requireContractAddress();
      const tokenIdBig = BigInt(tokenId);

      const task = (async () => {
        setIsLoadingPostComments((prev) => ({ ...prev, [tokenId]: true }));
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const readContract = getSocialContract(address, provider);

          const filter = readContract.filters.PostCommented(null, tokenIdBig);
          const logs = await readContract.queryFilter(filter, 0, "latest");

          const parsed: PostComment[] = logs
            .flatMap((log) => {
              const desc = socialInterface.parseLog(log);
              if (!desc) return [];
              return [
                {
                  commenter: String(desc.args.commenter),
                  comment: String(desc.args.comment),
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber
                } satisfies PostComment
              ];
            })
            .sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));

          setPostComments((prev) => ({ ...prev, [tokenId]: parsed }));
        } catch (err) {
          setStatus(getErrorMessage(err));
        } finally {
          setIsLoadingPostComments((prev) => ({ ...prev, [tokenId]: false }));
        }
      })();

      commentsInFlightRef.current[tokenId] = task;
      try {
        await task;
      } finally {
        if (commentsInFlightRef.current[tokenId] === task) {
          commentsInFlightRef.current[tokenId] = null;
        }
      }
    },
    [provider, requireContractAddress, ensureContractDeployedOnCurrentNetwork]
  );

  async function runContractTx<T>(
    label: string,
    send: () => Promise<ethers.TransactionResponse>,
    onReceipt?: (receipt: ethers.TransactionReceipt) => Promise<T> | T
  ): Promise<T | undefined> {
    let signingToastId: string | null = null;
    try {
      await ensureContractDeployedOnCurrentNetwork();
      setStatus(`${label} (confirm in wallet)...`);

      // Show a toast immediately so the user knows they must confirm in their wallet.
      signingToastId = txNotifications.notifySigning(label);

      const tx = await send();

      if (signingToastId) {
        txNotifications.dismiss(signingToastId);
        signingToastId = null;
      }

      const explorerUrl = getExplorerTxUrl(chainId, tx.hash);
      txNotifications.notifyPending({ hash: tx.hash, label, explorerUrl });

      setStatus(`${label}: pending...`);
      const receipt = await tx.wait();

      if (!receipt) {
        txNotifications.notifyFailed({ hash: tx.hash, label, error: "Transaction receipt unavailable." });
        setStatus("Transaction receipt unavailable.");
        return undefined;
      }

      txNotifications.notifyConfirmed(tx.hash);
      setStatus(`${label}: confirmed.`);
      if (onReceipt) return await onReceipt(receipt);
      return undefined;
    } catch (error) {
      if (signingToastId) {
        txNotifications.dismiss(signingToastId);
        signingToastId = null;
      }
      const message = getErrorMessage(error);
      setStatus(message);

      if (isUserRejectedTx(error)) {
        txNotifications.notifyCancelled(label);
      }

      const hash = (error as any)?.transaction?.hash ?? (error as any)?.hash;
      if (typeof hash === "string") {
        txNotifications.notifyFailed({ hash, label, error: message });
      } else if (!isUserRejectedTx(error)) {
        txNotifications.notifyFailed({ label, error: message });
      }
      throw error;
    }
  }

  const refreshWalletPanel = useCallback(async () => {
    if (!provider || !walletAddress) return;
    if (refreshWalletInFlightRef.current) {
      await refreshWalletInFlightRef.current;
      return;
    }

    const task = (async () => {
      try {
        const [network, balanceWei] = await Promise.all([
          provider.getNetwork(),
          provider.getBalance(walletAddress)
        ]);
        setNetworkName(network.name);
        chainIdNumberRef.current = Number(network.chainId);
        setChainId(network.chainId.toString());
        setNativeBalance(Number(ethers.formatEther(balanceWei)).toFixed(4));

        const contractAddress = resolveContractAddress(chainIdNumberRef.current);
        if (contractAddress) {
          const code = await provider.getCode(contractAddress);
          setContractDeployed(Boolean(code && code !== "0x"));
        } else {
          setContractDeployed(null);
        }

        try {
          const readContract = await getReadContract();
          const w = (await readContract.withdrawableOf(walletAddress)) as bigint;
          setWithdrawableTipsWei(w);
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    })();

    refreshWalletInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (refreshWalletInFlightRef.current === task) {
        refreshWalletInFlightRef.current = null;
      }
    }
  }, [provider, walletAddress, requireContractAddress]);

  const refreshFeed = useCallback(async () => {
    if (!provider) return;
    if (refreshFeedInFlightRef.current) {
      await refreshFeedInFlightRef.current;
      return;
    }

    const mapWithConcurrency = async <T, R>(
      items: T[],
      limit: number,
      fn: (item: T, index: number) => Promise<R>
    ): Promise<R[]> => {
      const results: R[] = new Array(items.length);
      let nextIndex = 0;
      const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
          const i = nextIndex++;
          if (i >= items.length) break;
          results[i] = await fn(items[i], i);
        }
      });
      await Promise.all(workers);
      return results;
    };

    const task = (async () => {
      try {
        setIsFeedLoading(true);
        setStatus("Loading posts... (this can take a few seconds on testnets)");

        type FeedTarget = {
          chainIdNumber: number;
          chainId: string;
          contractAddress: string;
          provider: ethers.Provider;
        };

        const targets: FeedTarget[] = [];

        // Always include current chain if we can resolve an address.
        const currentChainIdNumber = chainIdNumberRef.current;
        const currentContract = resolveContractAddress(currentChainIdNumber);
        if (typeof currentChainIdNumber === "number" && currentContract) {
          targets.push({
            chainIdNumber: currentChainIdNumber,
            chainId: String(currentChainIdNumber),
            contractAddress: currentContract,
            provider
          });
        }

        // Add other chains only when both contract address AND VITE RPC URL are configured.
        for (const [chainIdRaw, contractAddress] of Object.entries(CONTRACT_ADDRESS_BY_CHAIN_ID)) {
          const chainIdNumber = Number(chainIdRaw);
          if (!Number.isFinite(chainIdNumber)) continue;
          if (!contractAddress) continue;
          if (chainIdNumber === currentChainIdNumber) continue;
          const rpcUrl = RPC_URL_BY_CHAIN_ID[chainIdNumber];
          if (!rpcUrl) continue;

          targets.push({
            chainIdNumber,
            chainId: String(chainIdNumber),
            contractAddress,
            provider: new ethers.JsonRpcProvider(rpcUrl)
          });
        }

        if (targets.length === 0) {
          setPosts([]);
          setStatus("No networks configured for the feed.");
          return;
        }

        const loadPostsForTarget = async (target: FeedTarget): Promise<Post[]> => {
          const code = await target.provider.getCode(target.contractAddress);
          if (!code || code === "0x") return [];

          const readContract = getSocialContract(target.contractAddress, target.provider);

          // Some providers fail when querying logs from block 0 to latest. Fetch logs in an adaptive window.
          const fetchMintedEvents = async () => {
            const latest = await target.provider.getBlockNumber();

            let windowSize = 200_000;
            const maxWindowSize = Math.max(windowSize, latest);
            const minWindowSize = 2_000;

            while (true) {
              const fromBlock = Math.max(0, latest - windowSize);
              try {
                const events = await readContract.queryFilter(readContract.filters.PostMinted(), fromBlock, latest);
                if (events.length > 0 || fromBlock === 0) return events;

                if (windowSize >= maxWindowSize) return events;
                windowSize = Math.min(maxWindowSize, windowSize * 2);
              } catch (err) {
                if (windowSize <= minWindowSize) throw err;
                windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
              }
            }
          };

          const mintedEvents = await fetchMintedEvents();
          const eventsNewestFirst = mintedEvents.slice().reverse();

          const blockTimestampCache = new Map<number, number>();
          const getTimestamp = async (blockNumber: number) => {
            const cached = blockTimestampCache.get(blockNumber);
            if (typeof cached === "number") return cached;
            try {
              const block = await target.provider.getBlock(blockNumber);
              const ts = (block as any)?.timestamp;
              const n = typeof ts === "number" ? ts : Number(ts);
              if (Number.isFinite(n)) {
                blockTimestampCache.set(blockNumber, n);
                return n;
              }
            } catch {
              // ignore
            }
            return undefined;
          };

          const minted = await mapWithConcurrency(eventsNewestFirst, 6, async (event) => {
            const anyEvent = event as any;
            const args = anyEvent.args as any[] | undefined;
            const author = args?.[0] as string | undefined;
            const tokenIdBig = args?.[1] as bigint | undefined;
            if (!tokenIdBig) return null;

            // IMPORTANT: minted events remain even after a burn.
            const exists = (await readContract.exists(tokenIdBig)) as boolean;
            if (!exists) return null;

            let tokenUri = "";
            let likesRaw = 0n;
            let commentsRaw = 0n;
            let sharesRaw = 0n;
            let tipsWei = 0n;
            try {
              [tokenUri, likesRaw, commentsRaw, sharesRaw, tipsWei] = await Promise.all([
                readContract.tokenURI(tokenIdBig) as Promise<string>,
                readContract.likesOf(tokenIdBig) as Promise<bigint>,
                readContract.commentsOf(tokenIdBig) as Promise<bigint>,
                readContract.sharesOf(tokenIdBig) as Promise<bigint>,
                readContract.tipsOf(tokenIdBig) as Promise<bigint>
              ]);
            } catch {
              return null;
            }

            const tokenId = tokenIdBig.toString();
            const meta = await fetchTokenMetadata(tokenUri);

            const blockNumber = (event as any)?.blockNumber as number | undefined;
            const mintTimestamp = typeof blockNumber === "number" ? await getTimestamp(blockNumber) : undefined;

            const post: Post = {
              tokenId,
              chainId: target.chainId,
              title: meta?.name ?? `Token #${tokenId}`,
              body: meta?.description ?? "",
              image: meta?.image ?? "",
              metadataURI: tokenUri,
              author,
              mintTxHash: (event as any)?.transactionHash as string | undefined,
              mintBlockNumber: blockNumber,
              mintTimestamp,
              likes: Number(likesRaw),
              comments: Number(commentsRaw),
              shares: Number(sharesRaw),
              tipsWei
            };
            return post;
          });

          return minted.filter((post): post is Post => post != null);
        };

        const settled = await Promise.allSettled(targets.map((t) => loadPostsForTarget(t)));
        const loaded: Post[] = [];
        for (const s of settled) {
          if (s.status === "fulfilled") loaded.push(...s.value);
        }

        // Sort newest-first when timestamps are available.
        loaded.sort((a, b) => {
          const at = a.mintTimestamp ?? 0;
          const bt = b.mintTimestamp ?? 0;
          if (bt !== at) return bt - at;
          const ab = a.mintBlockNumber ?? 0;
          const bb = b.mintBlockNumber ?? 0;
          if (bb !== ab) return bb - ab;
          return (b.tokenId ?? "").localeCompare(a.tokenId ?? "");
        });

        setPosts(loaded);
        setStatus("Feed loaded.");
      } catch (err) {
        setStatus(getErrorMessage(err));
        throw err;
      } finally {
        setIsFeedLoading(false);
      }
    })();

    refreshFeedInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (refreshFeedInFlightRef.current === task) {
        refreshFeedInFlightRef.current = null;
      }
    }
  }, [provider]);

  const connectWallet = useCallback(async () => {
    try {
      if (!provider) {
        setStatus("Install a wallet like MetaMask to continue.");
        return;
      }

      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      // User explicitly connected; re-enable auto-connect.
      setIsWalletAutoConnectDisabled(false);
      try {
        localStorage.setItem(WALLET_DISCONNECTED_KEY, "0");
      } catch {
        // ignore
      }

      setWalletAddress(address);
      chainIdNumberRef.current = Number(network.chainId);
      setChainId(network.chainId.toString());
      setNetworkName(network.name);
      setStatus("Wallet connected.");

      const balanceWei = await provider.getBalance(address);
      setNativeBalance(Number(ethers.formatEther(balanceWei)).toFixed(4));

      const contractAddress = resolveContractAddress(chainIdNumberRef.current);
      if (!contractAddress) {
        setStatus(
          "Wallet connected, but no contract address is configured for this network. Set VITE_CONTRACT_ADDRESS_ETH (Ethereum 1) and/or VITE_CONTRACT_ADDRESS_BASE (Base 8453) in .env.local, then restart the dev server."
        );
      }

      await refreshFeed();
    } catch {
      setStatus("Wallet connection rejected.");
    }
  }, [provider, refreshFeed]);

  const disconnectWallet = useCallback(() => {
    // Wallet extensions (e.g. MetaMask) don't support a true programmatic disconnect.
    // This clears the app's local session state.
    setWalletAddress(null);
    setNativeBalance("—");
    setWithdrawableTipsWei(0n);
    setContractDeployed(null);
    setStatus("Wallet disconnected");

    setIsWalletAutoConnectDisabled(true);
    try {
      localStorage.setItem(WALLET_DISCONNECTED_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (!provider) return;

        // Always resolve chain info on page load, even if the wallet isn't connected.
        // This ensures we can select the correct contract address (e.g. Sepolia/Base/BSC)
        // and load the feed in read-only mode.
        try {
          const network = await provider.getNetwork();
          chainIdNumberRef.current = Number(network.chainId);
          setChainId(network.chainId.toString());
          setNetworkName(network.name);
        } catch {
          // ignore
        }

        const accounts = (await provider.send("eth_accounts", [])) as string[];
        const addr = isWalletAutoConnectDisabled ? null : (accounts?.[0] ?? null);
        if (!addr) {
          setStatus("Wallet disconnected");

          // Load the feed in read-only mode (multi-chain if configured).
          try {
            await refreshFeed();
          } catch {
            // ignore
          }
          return;
        }

        const network = await provider.getNetwork();
        setWalletAddress(addr);
        chainIdNumberRef.current = Number(network.chainId);
        setChainId(network.chainId.toString());
        setNetworkName(network.name);
        setStatus("Wallet connected.");

        await refreshWalletPanel();

        try {
          await refreshFeed();
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    };

    void bootstrap();
  }, [provider, refreshFeed, refreshWalletPanel, isWalletAutoConnectDisabled]);

  useEffect(() => {
    if (!provider) return;
    const eth = (window.ethereum as any) ?? null;
    if (!eth?.on) return;

    const onAccountsChanged = async (accounts: string[]) => {
      if (isWalletAutoConnectDisabled) {
        setWalletAddress(null);
        setNativeBalance("—");
        setWithdrawableTipsWei(0n);
        setStatus("Wallet disconnected");
        return;
      }

      const addr = accounts?.[0] ?? null;
      setWalletAddress(addr);
      setNativeBalance("—");
      setWithdrawableTipsWei(0n);

      try {
        const network = await provider.getNetwork();
        chainIdNumberRef.current = Number(network.chainId);
        setChainId(network.chainId.toString());
        setNetworkName(network.name);
      } catch {
        // ignore
      }

      if (!addr) {
        setStatus("Wallet disconnected");
        // Keep the feed available in read-only mode (multi-chain if configured).
        try {
          await refreshFeed();
        } catch {
          // ignore
        }
        return;
      }

      setStatus("Wallet connected.");
      // Let the existing refreshWalletPanel effect populate balance/tips.
      try {
        await refreshFeed();
      } catch {
        // ignore
      }
    };

    const onChainChanged = async (nextChainId?: string) => {
      try {
        setStatus("Network changed. Loading posts for the new network... (testnets can be slow)");
        setIsFeedLoading(true);
        setPosts([]);
        setPostComments({});
        setIsLoadingPostComments({});
        setWithdrawableTipsWei(0n);
        setContractDeployed(null);

        if (typeof nextChainId === "string" && nextChainId.length > 0) {
          const nextChainNumber = chainIdToNumber(nextChainId);
          chainIdNumberRef.current = nextChainNumber;
          if (typeof nextChainNumber === "number") {
            setChainId(nextChainNumber.toString());
          } else {
            setChainId(null);
          }
        }

        // Recreate provider to avoid stale network cache.
        setProviderNonce((n) => n + 1);
      } catch {
        // ignore
      }
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [provider, walletAddress, refreshFeed, isWalletAutoConnectDisabled]);

  useEffect(() => {
    void refreshWalletPanel();
  }, [refreshWalletPanel]);

  const handleDraftChange = (field: keyof Draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const onSelectComposerFile = async (file: File | null) => {
    try {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setStatus("Please select an image file.");
        return;
      }

      setIsImageLoading(true);
      setStatus("Processing uploaded image...");

      const compressToJpegDataUrl = async (blob: Blob, quality: number, maxDim: number) => {
        const objectUrl = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.decoding = "async";
          const loaded = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to decode image"));
          });
          img.src = objectUrl;
          await loaded;

          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not supported");
          ctx.drawImage(img, 0, 0, width, height);

          return canvas.toDataURL("image/jpeg", quality);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      const maxDataUrlChars = 90_000;
      const candidates = [
        { q: 0.78, dim: 640 },
        { q: 0.7, dim: 512 },
        { q: 0.62, dim: 512 },
        { q: 0.55, dim: 420 }
      ];
      let best: string | null = null;
      for (const c of candidates) {
        const attempt = await compressToJpegDataUrl(file, c.q, c.dim);
        best = attempt;
        if (attempt.length <= maxDataUrlChars) break;
      }

      if (!best || best.length > maxDataUrlChars) {
        setStatus(
          "Uploaded image is too large to embed on-chain. Use a smaller image, or paste an image URL (recommended: IPFS/http)."
        );
        return;
      }

      const blobRes = await fetch(best);
      const blob = await blobRes.blob();

      setDraft((prev) => ({ ...prev, imageDataUrl: best!, imageUrl: "" }));
      setUploadedImageBlob(blob);
      setUploadedImageFilename(file.name || "post-image.jpg");
      setStatus("Uploaded image ready.");
    } catch {
      setStatus("Failed to read image.");
    } finally {
      setIsImageLoading(false);
    }
  };

  const buildIpfsTokenUri = async (input: {
    draft: Draft;
    imageBlob: Blob | null;
    imageFilename: string;
  }) => {
    let imageRef = "";

    if (input.imageBlob) {
      const fileRes = await pinataPinFile(input.imageBlob, input.imageFilename || "post.jpg");
      imageRef = `ipfs://${fileRes.IpfsHash}`;
    } else if (input.draft.imageUrl) {
      try {
        const res = await fetch(input.draft.imageUrl);
        if (res.ok) {
          const blob = await res.blob();
          const fileRes = await pinataPinFile(blob, "post-image");
          imageRef = `ipfs://${fileRes.IpfsHash}`;
        } else {
          imageRef = input.draft.imageUrl;
        }
      } catch {
        imageRef = input.draft.imageUrl;
      }
    }

    const metadata = {
      description: input.draft.body,
      image: imageRef,
      attributes: [{ trait_type: "Origin", value: "Social Blockchain Network" }]
    };

    const metaRes = await pinataPinJson(metadata);
    return {
      tokenUri: `ipfs://${metaRes.IpfsHash}`,
      imageRef
    };
  };

  const mintPost = async () => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }
      if (isImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        return;
      }
      if (!draft.body || (!draft.imageUrl && !draft.imageDataUrl)) {
        setStatus("Fill out the post text and add an image URL or upload an image.");
        return;
      }

      const contract = await getContract();

      let metadataURI = "";
      let imageRefForUi = draft.imageDataUrl || draft.imageUrl;

      if (ipfsConfigured) {
        setStatus("Uploading to IPFS (Pinata)...");
        const built = await buildIpfsTokenUri({
          draft,
          imageBlob: uploadedImageBlob,
          imageFilename: uploadedImageFilename
        });
        metadataURI = built.tokenUri;
        imageRefForUi = built.imageRef || imageRefForUi;
      } else {
        metadataURI = createMetadataUri(draft);
        const maxTokenUriChars = 140_000;
        if (metadataURI.length > maxTokenUriChars) {
          setStatus(
            "Post metadata is too large to mint on-chain. Use IPFS pinning (recommended via a backend), or use a much smaller image."
          );
          return;
        }
      }

      const minted = await runContractTx(
        "Mint post NFT",
        () => contract.mintPost(metadataURI),
        async (receipt: ethers.TransactionReceipt) => {
          let mintedTokenId: string | null = null;
          let mintedAuthor: string | undefined;
          let mintTxHash: string | undefined;

          mintTxHash = receipt.hash;

          for (const log of receipt.logs) {
            try {
              const parsed = socialInterface.parseLog({
                topics: log.topics as string[],
                data: log.data
              });
              if (parsed?.name === "PostMinted") {
                mintedAuthor = parsed.args[0] as string;
                mintedTokenId = (parsed.args[1] as bigint).toString();
                break;
              }
            } catch {
              // not our event
            }
          }

          return { mintedTokenId, mintedAuthor, mintTxHash };
        }
      );

      if (!minted?.mintedTokenId) {
        setStatus("Mint confirmed, but tokenId could not be parsed. Reloading feed...");
        await refreshFeed();
        return;
      }

      const newPost: Post = {
        tokenId: minted.mintedTokenId,
        chainId: chainIdNumberRef.current ? String(chainIdNumberRef.current) : chainId ?? undefined,
        title: draft.title,
        body: draft.body,
        image: imageRefForUi,
        metadataURI,
        author: minted.mintedAuthor,
        mintTxHash: minted.mintTxHash,
        likes: 0,
        comments: 0,
        shares: 0,
        tipsWei: 0n
      };

      setPosts((prev) => [newPost, ...prev.filter((p) => p.tokenId !== minted.mintedTokenId)]);
      setDraft({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
      setUploadedImageBlob(null);
      setUploadedImageFilename("");
      setIsComposerOpen(false);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  const handleAction = async (tokenId: string, action: "like" | "comment", postChainId?: string | null) => {
    try {
      if (postChainId && chainId && postChainId !== chainId) {
        setStatus("Switch your wallet network to interact with this post.");
        return;
      }
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      const contract = await getContract();
      const tokenIdBig = BigInt(tokenId);

      if (action === "comment") {
        const comment = commentDrafts[tokenId];
        if (!comment) {
          setStatus("Write a comment before signing.");
          return;
        }
        const ok = await runContractTx("Comment", () => contract.commentPost(tokenIdBig, comment));
        setPosts((prev) =>
          prev.map((post) =>
            post.tokenId === tokenId ? { ...post, comments: post.comments + 1 } : post
          )
        );
        setCommentDrafts((prev) => ({ ...prev, [tokenId]: "" }));
        if (ok !== undefined) {
          void loadCommentsForPost(tokenId);
        }
        return;
      }

      if (action === "like") {
        await runContractTx("Like", () => contract.likePost(tokenIdBig));
        setPosts((prev) =>
          prev.map((post) => (post.tokenId === tokenId ? { ...post, likes: post.likes + 1 } : post))
        );
        return;
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  const startEditPost = (post: Post) => {
    setEditingTokenId(post.tokenId);
    setEditDraft({
      title: post.title,
      body: post.body,
      imageUrl: post.image,
      imageDataUrl: ""
    });
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
  };

  const cancelEditPost = () => {
    setEditingTokenId(null);
    setEditDraft({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
    setIsEditImageLoading(false);
  };

  const onEditSelectFile = async (file: File | null) => {
    try {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setStatus("Please select an image file.");
        return;
      }

      setIsEditImageLoading(true);
      setStatus("Processing uploaded image...");

      const compressToJpegDataUrl = async (blob: Blob, quality: number, maxDim: number) => {
        const objectUrl = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.decoding = "async";
          const loaded = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to decode image"));
          });
          img.src = objectUrl;
          await loaded;

          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not supported");
          ctx.drawImage(img, 0, 0, width, height);

          return canvas.toDataURL("image/jpeg", quality);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      const maxDataUrlChars = 90_000;
      const candidates = [
        { q: 0.78, dim: 640 },
        { q: 0.7, dim: 512 },
        { q: 0.62, dim: 512 },
        { q: 0.55, dim: 420 }
      ];
      let best: string | null = null;
      for (const c of candidates) {
        const attempt = await compressToJpegDataUrl(file, c.q, c.dim);
        best = attempt;
        if (attempt.length <= maxDataUrlChars) break;
      }
      if (!best || best.length > maxDataUrlChars) {
        setStatus("Uploaded image is too large. Try a smaller image.");
        return;
      }

      const blobRes = await fetch(best);
      const blob = await blobRes.blob();

      setEditDraft((prev) => ({ ...prev, imageDataUrl: best!, imageUrl: "" }));
      setEditUploadedImageBlob(blob);
      setEditUploadedImageFilename(file.name || "post-image.jpg");
      setStatus("Uploaded image ready.");
    } catch {
      setStatus("Failed to read image.");
    } finally {
      setIsEditImageLoading(false);
    }
  };

  const onEditClearImage = () => {
    setEditDraft((d) => ({ ...d, imageDataUrl: "" }));
    setEditUploadedImageBlob(null);
    setEditUploadedImageFilename("");
  };

  const saveEditedPost = async () => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }
      if (!editingTokenId) return;
      if (isEditImageLoading) {
        setStatus("Please wait for the uploaded image to finish processing.");
        return;
      }

      if (!editDraft.body.trim()) {
        setStatus("Post text is required.");
        return;
      }
      if (!editDraft.imageUrl.trim() && !editDraft.imageDataUrl.trim()) {
        setStatus("Add an image URL or upload an image.");
        return;
      }

      const contract = await getContract();
      const tokenIdBig = BigInt(editingTokenId);

      let tokenUri = "";
      if (ipfsConfigured) {
        setStatus("Uploading update to IPFS (Pinata)...");
        const built = await buildIpfsTokenUri({
          draft: editDraft,
          imageBlob: editUploadedImageBlob,
          imageFilename: editUploadedImageFilename
        });
        tokenUri = built.tokenUri;
      } else {
        tokenUri = createMetadataUri(editDraft);
        const maxTokenUriChars = 140_000;
        if (tokenUri.length > maxTokenUriChars) {
          setStatus("Updated metadata is too large. Configure IPFS (Pinata) or use a smaller image.");
          return;
        }
      }

      await runContractTx("Edit post", () => contract.updatePostURI(tokenIdBig, tokenUri));
      cancelEditPost();
      await refreshFeed();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  const burnPost = async (tokenId: string, postChainId?: string | null) => {
    try {
      if (postChainId && chainId && postChainId !== chainId) {
        setStatus("Switch your wallet network to burn this post.");
        return;
      }
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      const contract = await getContract();
      const tokenIdBig = BigInt(tokenId);
      await runContractTx("Burn post", () => contract.burnPost(tokenIdBig));

      // Only update UI after a successful burn tx.
      if (editingTokenId === tokenId) {
        cancelEditPost();
      }
      setPosts((prev) => prev.filter((p) => p.tokenId !== tokenId));
      setPostComments((prev) => {
        if (!(tokenId in prev)) return prev;
        const { [tokenId]: _, ...rest } = prev;
        return rest;
      });
      setTipDrafts((prev) => {
        if (!(tokenId in prev)) return prev;
        const { [tokenId]: _, ...rest } = prev;
        return rest;
      });
      setCommentDrafts((prev) => {
        if (!(tokenId in prev)) return prev;
        const { [tokenId]: _, ...rest } = prev;
        return rest;
      });

      await refreshFeed();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  const handleTip = async (tokenId: string, postChainId?: string | null) => {
    try {
      if (postChainId && chainId && postChainId !== chainId) {
        setStatus("Switch your wallet network to tip this post.");
        return;
      }
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      const raw = (tipDrafts[tokenId] ?? "").trim();
      const amount = raw.length ? Number(raw) : 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus("Enter a valid tip amount.");
        return;
      }

      const valueWei = ethers.parseEther(raw);
      const contract = await getContract();
      const tokenIdBig = BigInt(tokenId);

      await runContractTx("Tip", () => contract.tipPost(tokenIdBig, { value: valueWei }));

      setPosts((prev) =>
        prev.map((p) => (p.tokenId === tokenId ? { ...p, tipsWei: p.tipsWei + valueWei } : p))
      );
      setTipDrafts((prev) => ({ ...prev, [tokenId]: "" }));
      void refreshWalletPanel();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  const withdrawTips = async () => {
    try {
      if (!walletAddress) {
        setStatus("Connect your wallet first.");
        return;
      }

      const contract = await getContract();
      await runContractTx("Withdraw tips", () => contract.withdrawTips());
      void refreshWalletPanel();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  const onComposerImageUrlChange = (value: string) => {
    setDraft((prev) => ({ ...prev, imageUrl: value, imageDataUrl: "" }));
    if (value) {
      setUploadedImageBlob(null);
      setUploadedImageFilename("");
    }
  };

  const onComposerClearImage = () => {
    setDraft((prev) => ({ ...prev, imageDataUrl: "" }));
    setUploadedImageBlob(null);
    setUploadedImageFilename("");
  };

  const onTipDraftChange = (tokenId: string, value: string) => {
    setTipDrafts((prev) => ({
      ...prev,
      [tokenId]: value
    }));
  };

  const onCommentDraftChange = (tokenId: string, value: string) => {
    setCommentDrafts((prev) => ({
      ...prev,
      [tokenId]: value
    }));
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const openComposer = () => setIsComposerOpen(true);
  const closeComposer = () => setIsComposerOpen(false);

  const profileLink = walletAddress ? `/profile/${walletAddress}` : null;

  const value: AppContextValue = {
    theme,
    toggleTheme,

    walletAddress,
    chainId,
    networkName,
    nativeBalance,
    contractDeployed,
    contractAddress: contractAddressForChain,
    status,
    withdrawableTipsWei,

    connectWallet,
    disconnectWallet,
    refreshWalletPanel,
    withdrawTips,

    isFeedLoading,

    isComposerOpen,
    openComposer,
    closeComposer,
    ipfsConfigured,

    draft,
    isImageLoading,
    handleDraftChange,
    onComposerImageUrlChange,
    onComposerClearImage,
    onSelectComposerFile,
    mintPost,

    posts,
    refreshFeed,
    authorIdentity,

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

    editingTokenId,
    editDraft,
    isEditImageLoading,
    tipDrafts,
    commentDrafts,

    setEditDraft,

    onTipDraftChange,
    onCommentDraftChange,

    onEditSelectFile,
    onEditClearImage,

    startEditPost,
    cancelEditPost,
    saveEditedPost,

    burnPost,
    handleAction,
    handleTip,

    postComments,
    isLoadingPostComments,
    loadCommentsForPost,

    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
