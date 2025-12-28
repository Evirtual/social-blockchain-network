import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { getSocialContract, socialInterface } from "../contracts/socialPosts";
import { getExplorerTxUrl, getNativeSymbol } from "../lib/chain";
import { getErrorMessage } from "../lib/errors";
import { shortAddress, stableHueFromSeed } from "../lib/format";
import type { AppContextValue } from "./AppContext.types";

import { useContract } from "./ContractContext";
import { ComposerProvider, useComposer } from "./ComposerContext";
import { FeedProvider, useFeed } from "./FeedContext";
import { FollowProvider, useFollow } from "./FollowContext";
import { ProfileProvider, useProfile } from "./ProfileContext";
import { SocialActionsProvider, useSocialActions } from "./SocialActionsContext";
import { useStatus } from "./StatusContext";
import { useTheme } from "./ThemeContext";
import { useWallet } from "./WalletContext";

const AppContext = createContext<AppContextValue | null>(null);

function AppProviderInner({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const wallet = useWallet();
  const contract = useContract();
  const { status, setStatus } = useStatus();

  const feed = useFeed();
  const profile = useProfile();
  const follow = useFollow();
  const composer = useComposer();
  const social = useSocialActions();

  const [connectNudge, setConnectNudge] = useState(false);
  const connectNudgeTimeoutRef = useRef<number | null>(null);

  const nudgeConnectWallet = useCallback(() => {
    setConnectNudge(true);
    if (connectNudgeTimeoutRef.current !== null) {
      window.clearTimeout(connectNudgeTimeoutRef.current);
    }
    connectNudgeTimeoutRef.current = window.setTimeout(() => {
      setConnectNudge(false);
      connectNudgeTimeoutRef.current = null;
    }, 1400);
  }, []);

  const requireConnectedWallet = useCallback(() => {
    if (wallet.walletAddress) return true;
    nudgeConnectWallet();
    return false;
  }, [wallet.walletAddress, nudgeConnectWallet]);

  // Saved posts live here for now (not yet extracted into its own context).
  // NOTE: Values are stored as `chainId:tokenId` keys to avoid collisions across networks.
  const [savedTokenIdsByAddress, setSavedTokenIdsByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingSavedByAddress, setIsLoadingSavedByAddress] = useState<Record<string, boolean>>({});
  const savedInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const savedLoadedByKeyRef = useRef<Record<string, boolean>>({});

  // Likes live here for now.
  // NOTE: Values are stored as `chainId:tokenId` keys to avoid collisions across networks.
  const [likedTokenIdsByAddress, setLikedTokenIdsByAddress] = useState<Record<string, string[]>>({});
  const [isLoadingLikesByAddress, setIsLoadingLikesByAddress] = useState<Record<string, boolean>>({});
  const likesInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const likesLoadedByKeyRef = useRef<Record<string, boolean>>({});

  // Session-only cache so Saved doesn't re-load on route remounts.
  // Keyed only by address so Saved is stable across chain switches within the session.
  const SAVED_SESSION_CACHE_PREFIX = "savedTokenKeysByAddress:";

  // Session-only cache so Liked doesn't re-load on route remounts.
  // Keyed only by address so Liked is stable across chain switches within the session.
  const LIKES_SESSION_CACHE_PREFIX = "likesTokenKeysByAddress:";

  const makeSavedSessionCacheKey = useCallback(
    (addressLower: string) => {
      const addr = addressLower.trim().toLowerCase();
      if (!addr) return null;
      return `${SAVED_SESSION_CACHE_PREFIX}${addr}`;
    },
    []
  );

  const readSavedSessionCache = useCallback(
    (addressLower: string): string[] | null => {
      /* c8 ignore next */
      if (typeof window === "undefined") return null;
      try {
        const storageKey = makeSavedSessionCacheKey(addressLower);
        if (!storageKey) return null;
        const raw = window.sessionStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as any;
        const tokenIds = Array.isArray(parsed?.tokenIds)
          ? parsed.tokenIds.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
          : [];
        return tokenIds;
      } catch {
        return null;
      }
    },
    [makeSavedSessionCacheKey]
  );

  const writeSavedSessionCache = useCallback(
    (addressLower: string, tokenIds: string[]) => {
      /* c8 ignore next */
      if (typeof window === "undefined") return;
      try {
        const storageKey = makeSavedSessionCacheKey(addressLower);
        if (!storageKey) return;
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            tokenIds: tokenIds
              .filter((x) => typeof x === "string" && x.trim())
              .map((x) => x.trim())
          })
        );
      } catch {
        // ignore
      }
    },
    [makeSavedSessionCacheKey]
  );

  const makeLikesSessionCacheKey = useCallback(
    (addressLower: string) => {
      const addr = addressLower.trim().toLowerCase();
      if (!addr) return null;
      return `${LIKES_SESSION_CACHE_PREFIX}${addr}`;
    },
    []
  );

  const readLikesSessionCache = useCallback(
    (addressLower: string): string[] | null => {
      /* c8 ignore next */
      if (typeof window === "undefined") return null;
      try {
        const storageKey = makeLikesSessionCacheKey(addressLower);
        if (!storageKey) return null;
        const raw = window.sessionStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as any;
        const tokenIds = Array.isArray(parsed?.tokenIds)
          ? parsed.tokenIds.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
          : [];
        return tokenIds;
      } catch {
        return null;
      }
    },
    [makeLikesSessionCacheKey]
  );

  const writeLikesSessionCache = useCallback(
    (addressLower: string, tokenIds: string[]) => {
      /* c8 ignore next */
      if (typeof window === "undefined") return;
      try {
        const storageKey = makeLikesSessionCacheKey(addressLower);
        if (!storageKey) return;
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            tokenIds: tokenIds
              .filter((x) => typeof x === "string" && x.trim())
              .map((x) => x.trim())
          })
        );
      } catch {
        // ignore
      }
    },
    [makeLikesSessionCacheKey]
  );

  const connectWallet = useCallback(async () => {
    const addr = await wallet.connectWallet();
    if (!addr) return;

    // Refresh contract/wallet UI state best-effort.
    try {
      await contract.refreshContractState();
    } catch {
      // ignore
    }

    try {
      await contract.ensureContractDeployedOnCurrentNetwork();
    } catch (err) {
      setStatus(getErrorMessage(err));
    }

    void wallet.refreshWalletPanel();
    void feed.refreshFeed(addr);
  }, [wallet, contract, setStatus, feed]);

  const refreshFeed = useCallback(async () => {
    await feed.refreshFeed();
  }, [feed]);

  const withdrawTips = useCallback(async () => {
    if (!requireConnectedWallet()) return;
    await social.withdrawTips();
    // Keep wallet card values (withdrawable tips, deployed status) fresh.
    try {
      await contract.refreshContractState();
    } catch {
      // ignore
    }
  }, [requireConnectedWallet, social, contract]);

  const handleAction = useCallback(
    async (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null) => {
      if (!requireConnectedWallet()) return;
      const ok = await social.handleAction(tokenId, action, postChainId);

      // Saved feed is driven by savedTokenIdsByAddress, which was previously only updated
      // by an on-chain scan (loadSavedForAddress). Update it immediately on successful save.
      if (action === "save" && ok) {
        const key = wallet.walletAddress!.toLowerCase();

        const chainRaw = String(postChainId ?? wallet.chainId ?? "").trim();
        const chainNum = chainRaw.startsWith("0x") || chainRaw.startsWith("0X")
          ? Number.parseInt(chainRaw, 16)
          : Number.parseInt(chainRaw, 10);
        const chainKey = Number.isFinite(chainNum) ? String(chainNum) : chainRaw;
        const savedKey = chainKey ? `${chainKey}:${tokenId}` : tokenId;

        setSavedTokenIdsByAddress((prev) => {
          const current = prev[key] ?? [];
          const has = current.includes(savedKey);
          const next = has ? current.filter((id) => id !== savedKey) : [savedKey, ...current];
          writeSavedSessionCache(key, next);
          return { ...prev, [key]: next };
        });

        // Ensure the token exists in the local feed cache (saved view maps tokenIds -> posts).
        void feed.loadPostsByTokenIds([tokenId]);
      }

      // Liked feed is driven by likedTokenIdsByAddress. Update it immediately on successful like/unlike.
      if (action === "like" && ok) {
        const key = wallet.walletAddress!.toLowerCase();

        const chainRaw = String(postChainId ?? wallet.chainId ?? "").trim();
        const chainNum = chainRaw.startsWith("0x") || chainRaw.startsWith("0X")
          ? Number.parseInt(chainRaw, 16)
          : Number.parseInt(chainRaw, 10);
        const chainKey = Number.isFinite(chainNum) ? String(chainNum) : chainRaw;
        const likedKey = chainKey ? `${chainKey}:${tokenId}` : tokenId;

        setLikedTokenIdsByAddress((prev) => {
          const current = prev[key] ?? [];
          const has = current.includes(likedKey);
          const next = has ? current.filter((id) => id !== likedKey) : [likedKey, ...current];
          writeLikesSessionCache(key, next);
          return { ...prev, [key]: next };
        });

        void feed.loadPostsByTokenIds([tokenId]);
      }
    },
    [requireConnectedWallet, social, wallet.walletAddress, wallet.chainId, feed, writeSavedSessionCache, writeLikesSessionCache]
  );

  const loadLikesForAddress = useCallback(
    async (address: string) => {
      try {
        if (!address) return;

        const key = address.toLowerCase();

        // Avoid re-scanning once we have successfully loaded likes for this address on this network.
        const networkKey = String(wallet.chainId ?? contract.contractAddress ?? "").toLowerCase();
        const loadedKey = `${networkKey}:${key}`;
        if (loadedKey && likesLoadedByKeyRef.current[loadedKey]) return;

        const cached = readLikesSessionCache(key);
        if (cached !== null) {
          setLikedTokenIdsByAddress((prev) => ({ ...prev, [key]: cached }));
          likesLoadedByKeyRef.current[loadedKey] = true;
          return;
        }

        const existing = likesInFlightRef.current[key];
        if (existing) {
          await existing;
          return;
        }

        const task = (async () => {
          setIsLoadingLikesByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const env = import.meta.env as any;
            const chainIdRaw = wallet.chainId;
            const chainIdNum =
              typeof chainIdRaw === "string"
                ? Number.parseInt(chainIdRaw, chainIdRaw.startsWith("0x") ? 16 : 10)
                : NaN;
            const resolvedChainIdNum = Number.isFinite(chainIdNum) ? chainIdNum : null;

            const rpcUrlByChainId: Record<number, string | undefined> = {
              1: env.VITE_ETH_RPC_URL,
              11155111: env.VITE_ETH_SEPOLIA_RPC_URL,
              8453: env.VITE_BASE_RPC_URL,
              84532: env.VITE_BASE_SEPOLIA_RPC_URL,
              56: env.VITE_BSC_RPC_URL,
              97: env.VITE_BSC_TESTNET_RPC_URL,
              31337: env.VITE_LOCAL_RPC_URL
            };

            const rpcUrl =
              resolvedChainIdNum != null && typeof rpcUrlByChainId[resolvedChainIdNum] === "string"
                ? String(rpcUrlByChainId[resolvedChainIdNum]).trim()
                : "";

            let readContract: any = null;
            let scanProvider: any = null;

            if (rpcUrl && contract.contractAddress) {
              const rpcProvider: any = new ethers.JsonRpcProvider(rpcUrl, resolvedChainIdNum!);
              readContract = getSocialContract(contract.contractAddress, rpcProvider);
              scanProvider = rpcProvider;
            } else {
              if (!wallet.provider) return;
              await contract.ensureContractDeployedOnCurrentNetwork();
              readContract = await contract.getReadContract();

              const runner: any = (readContract as any).runner;
              scanProvider = runner?.provider ?? runner ?? wallet.provider;
            }

            const latestRaw = (await scanProvider?.getBlockNumber?.()) ?? 0;
            const latest = Number(latestRaw);
            if (!Number.isFinite(latest) || latest < 0) {
              throw new Error("RPC returned an invalid block number.");
            }

            const maxRounds = 60;
            const maxEvents = 5_000;
            let windowSize = 75_000;
            const minWindowSize = 2_000;

            const collected: ethers.Log[] = [];

            const pullRange = async (fromBlock: number, toBlock: number) => {
              const [liked, unliked] = await Promise.all([
                (readContract as any).queryFilter(
                  (readContract as any).filters.PostLiked(address, null),
                  fromBlock,
                  toBlock
                ),
                (readContract as any).queryFilter(
                  (readContract as any).filters.PostUnliked(address, null),
                  fromBlock,
                  toBlock
                )
              ]);
              const all = [...(liked as any[]), ...(unliked as any[])].map((log) => {
                const index = (log as any)?.index;
                const logIndex = (log as any)?.logIndex;
                if (index == null && logIndex != null) return { ...(log as any), index: logIndex };
                return log;
              });
              return all.sort((a, b) => {
                const ab = Number(a.blockNumber ?? 0);
                const bb = Number(b.blockNumber ?? 0);
                if (ab !== bb) return ab - bb;
                const ai = Number(a.index ?? 0);
                const bi = Number(b.index ?? 0);
                return ai - bi;
              });
            };

            let end = latest;
            for (let round = 0; round < maxRounds && end >= 0 && collected.length < maxEvents; round++) {
              const start = Math.max(0, end - windowSize);
              try {
                const logs = await pullRange(start, end);
                collected.unshift(...(logs as any));
                if (start === 0) break;
                end = start - 1;
              } catch {
                if (windowSize <= minWindowSize) throw new Error("RPC could not serve like log range.");
                windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
              }
            }

            const state = new Map<string, { liked: boolean; lastBlock: number }>();
            for (const log of collected) {
              let parsed: ethers.LogDescription | null = null;
              try {
                parsed = socialInterface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
              } catch {
                parsed = null;
              }
              if (!parsed) continue;

              const tokenIdBig = parsed.args?.[1] as bigint | undefined;
              if (!tokenIdBig) continue;

              const tokenId = tokenIdBig.toString();
              const blockNumber = Number((log as any).blockNumber ?? 0);

              if (parsed.name === "PostLiked") {
                state.set(tokenId, { liked: true, lastBlock: blockNumber });
              } else if (parsed.name === "PostUnliked") {
                state.set(tokenId, { liked: false, lastBlock: blockNumber });
              }
            }

            const activeTokenIds = Array.from(state.entries())
              .filter(([, v]) => v.liked)
              .sort((a, b) => b[1].lastBlock - a[1].lastBlock)
              .map(([tokenId]) => tokenId);

            const chainRaw = String(wallet.chainId ?? "").trim();
            const chainNum = chainRaw.startsWith("0x") || chainRaw.startsWith("0X")
              ? Number.parseInt(chainRaw, 16)
              : Number.parseInt(chainRaw, 10);
            const chainKey = Number.isFinite(chainNum) ? String(chainNum) : chainRaw;
            const activeKeys = chainKey ? activeTokenIds.map((id) => `${chainKey}:${id}`) : activeTokenIds;

            setLikedTokenIdsByAddress((prev) => {
              const existingLikes = prev[key] ?? [];
              const preserved = chainKey ? existingLikes.filter((k) => !k.startsWith(`${chainKey}:`)) : existingLikes;
              const merged = Array.from(new Set([...activeKeys, ...preserved]));
              writeLikesSessionCache(key, merged);
              return { ...prev, [key]: merged };
            });

            await feed.loadPostsByTokenIds(activeTokenIds);

            likesLoadedByKeyRef.current[loadedKey] = true;
          } finally {
            setIsLoadingLikesByAddress((prev) => ({ ...prev, [key]: false }));
          }
        })();

        likesInFlightRef.current[key] = task;
        try {
          await task;
        } finally {
          if (likesInFlightRef.current[key] === task) likesInFlightRef.current[key] = null;
        }
      } catch (err) {
        setStatus(getErrorMessage(err));
      }
    },
    [wallet.provider, wallet.chainId, contract, contract.contractAddress, feed, setStatus, readLikesSessionCache, writeLikesSessionCache]
  );

  const handleTip = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      if (!requireConnectedWallet()) return;
      const ok = await social.handleTip(tokenId, postChainId);
      if (!ok) return;

      // Tips impact withdrawable balance shown in WalletCard; refresh after tx completes.
      try {
        await contract.refreshContractState();
      } catch {
        // ignore
      }
    },
    [requireConnectedWallet, social, contract]
  );

  const burnPost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      if (!requireConnectedWallet()) return;
      await social.burnPost(tokenId, postChainId);
    },
    [requireConnectedWallet, social]
  );

  const freezePost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      if (!requireConnectedWallet()) return;
      await social.freezePost(tokenId, postChainId);
    },
    [requireConnectedWallet, social]
  );

  const toggleFollow = useCallback(
    async (followee: string) => {
      if (!requireConnectedWallet()) return;
      await follow.toggleFollow(followee);
    },
    [requireConnectedWallet, follow]
  );

  const loadSavedForAddress = useCallback(
    async (address: string) => {
      try {
        if (!address) return;

        const key = address.toLowerCase();

        // Avoid re-scanning (and flickering the Saved loading state) once we have
        // successfully loaded saved posts for this address on this network.
        const networkKey = String(wallet.chainId ?? contract.contractAddress ?? "").toLowerCase();
        const loadedKey = `${networkKey}:${key}`;
        if (loadedKey && savedLoadedByKeyRef.current[loadedKey]) return;

        const cached = readSavedSessionCache(key);
        if (cached !== null) {
          setSavedTokenIdsByAddress((prev) => ({ ...prev, [key]: cached }));
          savedLoadedByKeyRef.current[loadedKey] = true;
          return;
        }

        const existing = savedInFlightRef.current[key];
        if (existing) {
          await existing;
          return;
        }

        const task = (async () => {
          setIsLoadingSavedByAddress((prev) => ({ ...prev, [key]: true }));
          try {
            const env = import.meta.env as any;
            const chainIdRaw = wallet.chainId;
            const chainIdNum = typeof chainIdRaw === "string" ? Number.parseInt(chainIdRaw, chainIdRaw.startsWith("0x") ? 16 : 10) : NaN;
            const resolvedChainIdNum = Number.isFinite(chainIdNum) ? chainIdNum : null;

            const rpcUrlByChainId: Record<number, string | undefined> = {
              1: env.VITE_ETH_RPC_URL,
              11155111: env.VITE_ETH_SEPOLIA_RPC_URL,
              8453: env.VITE_BASE_RPC_URL,
              84532: env.VITE_BASE_SEPOLIA_RPC_URL,
              56: env.VITE_BSC_RPC_URL,
              97: env.VITE_BSC_TESTNET_RPC_URL,
              31337: env.VITE_LOCAL_RPC_URL
            };

            const rpcUrl =
              resolvedChainIdNum != null && typeof rpcUrlByChainId[resolvedChainIdNum] === "string"
                ? String(rpcUrlByChainId[resolvedChainIdNum]).trim()
                : "";

            // Prefer env/read-only RPC for log scans, even when wallet is connected.
            // Some wallet RPCs are rate-limited or block eth_getLogs, which can leave Saved empty.
            let readContract: any = null;
            let scanProvider: any = null;

            if (rpcUrl && contract.contractAddress) {
              const rpcProvider: any = new ethers.JsonRpcProvider(rpcUrl, resolvedChainIdNum!);
              readContract = getSocialContract(contract.contractAddress, rpcProvider);
              scanProvider = rpcProvider;
            } else {
              if (!wallet.provider) return;
              await contract.ensureContractDeployedOnCurrentNetwork();
              readContract = await contract.getReadContract();

              const runner: any = (readContract as any).runner;
              scanProvider = runner?.provider ?? runner ?? wallet.provider;
            }

            const latestRaw = (await scanProvider?.getBlockNumber?.()) ?? 0;
            const latest = Number(latestRaw);
            if (!Number.isFinite(latest) || latest < 0) {
              throw new Error("RPC returned an invalid block number.");
            }
            const maxRounds = 60;
            const maxEvents = 5_000;
            let windowSize = 75_000;
            const minWindowSize = 2_000;

            const collected: ethers.Log[] = [];

            const pullRange = async (fromBlock: number, toBlock: number) => {
              const [shared, unshared] = await Promise.all([
                (readContract as any).queryFilter(
                  (readContract as any).filters.PostSaved(address, null),
                  fromBlock,
                  toBlock
                ),
                (readContract as any).queryFilter(
                  (readContract as any).filters.PostUnsaved(address, null),
                  fromBlock,
                  toBlock
                )
              ]);
              return [...(shared as any[]), ...(unshared as any[])].sort((a, b) => {
                const ab = Number(a.blockNumber ?? 0);
                const bb = Number(b.blockNumber ?? 0);
                if (ab !== bb) return ab - bb;
                const ai = Number(a.index ?? a.logIndex ?? 0);
                const bi = Number(b.index ?? b.logIndex ?? 0);
                return ai - bi;
              });
            };

            let end = latest;
            for (let round = 0; round < maxRounds && end >= 0 && collected.length < maxEvents; round++) {
              const start = Math.max(0, end - windowSize);
              try {
                const logs = await pullRange(start, end);
                collected.unshift(...(logs as any));
                if (start === 0) break;
                end = start - 1;
              } catch {
                if (windowSize <= minWindowSize) throw new Error("RPC could not serve saved log range.");
                windowSize = Math.max(minWindowSize, Math.floor(windowSize / 2));
              }
            }

            const state = new Map<string, { saved: boolean; lastBlock: number }>();
            for (const log of collected) {
              let parsed: ethers.LogDescription | null = null;
              try {
                parsed = socialInterface.parseLog({ topics: (log as any).topics as string[], data: (log as any).data });
              } catch {
                parsed = null;
              }
              if (!parsed) continue;

              const tokenIdBig = parsed.args?.[1] as bigint | undefined;
              if (!tokenIdBig) continue;

              const tokenId = tokenIdBig.toString();
              const blockNumber = Number((log as any).blockNumber ?? 0);

              if (parsed.name === "PostSaved") {
                state.set(tokenId, { saved: true, lastBlock: blockNumber });
              } else if (parsed.name === "PostUnsaved") {
                state.set(tokenId, { saved: false, lastBlock: blockNumber });
              }
            }

            const activeTokenIds = Array.from(state.entries())
              .filter(([, v]) => v.saved)
              .sort((a, b) => b[1].lastBlock - a[1].lastBlock)
              .map(([tokenId]) => tokenId);

            const chainRaw = String(wallet.chainId ?? "").trim();
            const chainNum = chainRaw.startsWith("0x") || chainRaw.startsWith("0X")
              ? Number.parseInt(chainRaw, 16)
              : Number.parseInt(chainRaw, 10);
            const chainKey = Number.isFinite(chainNum) ? String(chainNum) : chainRaw;
            const activeKeys = chainKey
              ? activeTokenIds.map((id) => `${chainKey}:${id}`)
              : activeTokenIds;

            setSavedTokenIdsByAddress((prev) => {
              const existing = prev[key] ?? [];
              const preserved = chainKey
                ? existing.filter((k) => !k.startsWith(`${chainKey}:`))
                : existing;
              const merged = Array.from(new Set([...activeKeys, ...preserved]));
              writeSavedSessionCache(key, merged);
              return { ...prev, [key]: merged };
            });

            await feed.loadPostsByTokenIds(activeTokenIds);

            savedLoadedByKeyRef.current[loadedKey] = true;
          } finally {
            setIsLoadingSavedByAddress((prev) => ({ ...prev, [key]: false }));
          }
        })();

        savedInFlightRef.current[key] = task;
        try {
          await task;
        } finally {
          if (savedInFlightRef.current[key] === task) savedInFlightRef.current[key] = null;
        }
      } catch (err) {
        setStatus(getErrorMessage(err));
      }
    },
    [wallet.provider, wallet.chainId, contract, contract.contractAddress, feed, setStatus, readSavedSessionCache, writeSavedSessionCache]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      // Theme
      theme: theme.theme,
      toggleTheme: theme.toggleTheme,

      // UI
      connectNudge,

      // Wallet + chain
      walletAddress: wallet.walletAddress,
      chainId: wallet.chainId,
      networkName: wallet.networkName,
      nativeBalance: wallet.nativeBalance,
      contractDeployed: contract.contractDeployed,
      contractAddress: contract.contractAddress,
      status,
      withdrawableTipsWei: contract.withdrawableTipsWei,

      connectWallet,
      disconnectWallet: wallet.disconnectWallet,
      refreshWalletPanel: wallet.refreshWalletPanel,
      withdrawTips,

      // Feed loading
      isFeedLoading: feed.isFeedLoading,

      // Composer
      isComposerOpen: composer.isComposerOpen,
      openComposer: composer.openComposer,
      closeComposer: composer.closeComposer,
      ipfsConfigured: composer.ipfsConfigured,

      draft: composer.draft,
      isImageLoading: composer.isImageLoading,
      handleDraftChange: composer.handleDraftChange,
      onComposerImageUrlChange: composer.onComposerImageUrlChange,
      onComposerClearImage: composer.onComposerClearImage,
      onSelectComposerFile: composer.onSelectComposerFile,
      mintPost: composer.mintPost,

      approvalRequired: composer.approvalRequired,
      approvalRequested: composer.approvalRequested,
      requestApproval: composer.requestApproval,
      dismissApproval: composer.dismissApproval,

      // Feed + posts
      posts: feed.posts,
      refreshFeed,
      authorIdentity: profile.authorIdentity,

      // On-chain profiles (cache)
      profilesByAddress: profile.profilesByAddress,
      loadProfile: profile.loadProfile,

      // Profile (self)
      profileName: profile.profileName,
      profileBio: profile.profileBio,
      profileAvatarUrl: profile.profileAvatarUrl,
      displayName: profile.displayName,
      myPostsCount: profile.myPostsCount,
      isEditingProfile: profile.isEditingProfile,
      profileDraftName: profile.profileDraftName,
      profileDraftBio: profile.profileDraftBio,
      profileDraftAvatarUrl: profile.profileDraftAvatarUrl,
      profileDraftAvatarDataUrl: profile.profileDraftAvatarDataUrl,
      isProfileAvatarLoading: profile.isProfileAvatarLoading,
      setProfileDraftName: profile.setProfileDraftName,
      setProfileDraftBio: profile.setProfileDraftBio,
      setProfileDraftAvatarUrl: profile.setProfileDraftAvatarUrl,
      onSelectProfileAvatarFile: profile.onSelectProfileAvatarFile,
      onClearProfileAvatar: profile.onClearProfileAvatar,
      startEditProfile: profile.startEditProfile,
      cancelEditProfile: profile.cancelEditProfile,
      saveProfile: profile.saveProfile,
      selfAvatarHue: profile.selfAvatarHue,
      profileLink: profile.profileLink,

      // Per-post UI state + actions
      editingTokenId: social.editingTokenId,
      editDraft: social.editDraft,
      isEditImageLoading: social.isEditImageLoading,
      tipDrafts: social.tipDrafts,
      commentDrafts: social.commentDrafts,

      setEditDraft: social.setEditDraft,

      onTipDraftChange: social.onTipDraftChange,
      onCommentDraftChange: social.onCommentDraftChange,
      onEditSelectFile: social.onEditSelectFile,
      onEditClearImage: social.onEditClearImage,
      startEditPost: social.startEditPost,
      cancelEditPost: social.cancelEditPost,
      saveEditedPost: social.saveEditedPost,
      handleAction,
      handleTip,
      burnPost,
      freezePost,

      // Comments
      postComments: feed.postComments,
      isLoadingPostComments: feed.isLoadingPostComments,
      loadCommentsForPost: feed.loadCommentsForPost,

      // Follow graph (cache)
      isFollowingByAddress: follow.isFollowingByAddress,
      loadIsFollowing: follow.loadIsFollowing,
      toggleFollow,

      // Saved
      savedTokenIdsByAddress,
      isLoadingSavedByAddress,
      loadSavedForAddress,

      // Likes
      likedTokenIdsByAddress,
      isLoadingLikesByAddress,
      loadLikesForAddress,

      // Followers
      followerCountByAddress: follow.followerCountByAddress,
      isLoadingFollowerCountByAddress: follow.isLoadingFollowerCountByAddress,
      loadFollowerCountForAddress: follow.loadFollowerCountForAddress,

      // Followers + Following lists
      followersByAddress: follow.followersByAddress,
      isLoadingFollowersByAddress: follow.isLoadingFollowersByAddress,
      loadFollowersForAddress: follow.loadFollowersForAddress,
      followingByAddress: follow.followingByAddress,
      isLoadingFollowingByAddress: follow.isLoadingFollowingByAddress,
      loadFollowingForAddress: follow.loadFollowingForAddress,

      // Shared helpers
      shortAddress,
      stableHueFromSeed,
      getNativeSymbol,
      getExplorerTxUrl,

      // Owner/admin UX
      isOwner: contract.isOwner
    }),
    [
      theme.theme,
      theme.toggleTheme,
      connectNudge,
      wallet.walletAddress,
      wallet.chainId,
      wallet.networkName,
      wallet.nativeBalance,
      wallet.disconnectWallet,
      wallet.refreshWalletPanel,
      contract.contractDeployed,
      contract.contractAddress,
      contract.withdrawableTipsWei,
      status,
      connectWallet,
      withdrawTips,
      feed.isFeedLoading,
      composer.isComposerOpen,
      composer.openComposer,
      composer.closeComposer,
      composer.ipfsConfigured,
      composer.draft,
      composer.isImageLoading,
      composer.handleDraftChange,
      composer.onComposerImageUrlChange,
      composer.onComposerClearImage,
      composer.onSelectComposerFile,
      composer.mintPost,
      composer.approvalRequired,
      composer.approvalRequested,
      composer.requestApproval,
      composer.dismissApproval,
      feed.posts,
      refreshFeed,
      profile.authorIdentity,
      profile.profilesByAddress,
      profile.loadProfile,
      profile.profileName,
      profile.profileBio,
      profile.profileAvatarUrl,
      profile.displayName,
      profile.myPostsCount,
      profile.isEditingProfile,
      profile.profileDraftName,
      profile.profileDraftBio,
      profile.profileDraftAvatarUrl,
      profile.profileDraftAvatarDataUrl,
      profile.isProfileAvatarLoading,
      profile.setProfileDraftName,
      profile.setProfileDraftBio,
      profile.setProfileDraftAvatarUrl,
      profile.onSelectProfileAvatarFile,
      profile.onClearProfileAvatar,
      profile.startEditProfile,
      profile.cancelEditProfile,
      profile.profileLink,
      profile.saveProfile,
      profile.selfAvatarHue,
      social.editingTokenId,
      social.editDraft,
      social.isEditImageLoading,
      social.tipDrafts,
      social.commentDrafts,
      social.setEditDraft,
      social.onTipDraftChange,
      social.onCommentDraftChange,
      social.onEditSelectFile,
      social.onEditClearImage,
      social.startEditPost,
      social.cancelEditPost,
      social.saveEditedPost,
      handleAction,
      handleTip,
      burnPost,
      freezePost,
      feed.postComments,
      feed.isLoadingPostComments,
      feed.loadCommentsForPost,
      follow.isFollowingByAddress,
      follow.loadIsFollowing,
      toggleFollow,
      savedTokenIdsByAddress,
      isLoadingSavedByAddress,
      loadSavedForAddress,
      likedTokenIdsByAddress,
      isLoadingLikesByAddress,
      loadLikesForAddress,
      follow.followerCountByAddress,
      follow.isLoadingFollowerCountByAddress,
      follow.loadFollowerCountForAddress,
      follow.followersByAddress,
      follow.isLoadingFollowersByAddress,
      follow.loadFollowersForAddress,
      follow.followingByAddress,
      follow.isLoadingFollowingByAddress,
      follow.loadFollowingForAddress,
      contract.isOwner
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <FeedProvider>
      <ProfileProvider>
        <FollowProvider>
          <ComposerProvider>
            <SocialActionsProvider>
              <AppProviderInner>{children}</AppProviderInner>
            </SocialActionsProvider>
          </ComposerProvider>
        </FollowProvider>
      </ProfileProvider>
    </FeedProvider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
