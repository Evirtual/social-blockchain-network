import { usePostActionsController } from "@features/post/actions";
import { useContractState } from "@features/contract";
import { useComposer } from "@features/composer";
import { useFeedQueries } from "@features/feed";
import { useProfileState } from "@features/profile";
import { useWalletState } from "@features/wallet";
import { useStatusState } from "@features/status";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/network";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { HomePage } from "./HomePage";
import { buildHomePageViewModel } from "../viewModel/buildHomePageViewModel";
import { useMemo } from "react";

function hashToInt(s: string): number {
  // Simple deterministic hash (not crypto) for stable demo choices.
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickDemoName(addressLower: string): string {
  const names = [
    "alice",
    "bob",
    "charlie",
    "dora",
    "eve",
    "frank",
    "grace",
    "heidi",
    "ivan",
    "judy",
    "mallory",
    "oscar",
    "peggy",
    "trent",
    "victor",
    "wendy"
  ];
  const i = hashToInt(addressLower) % names.length;
  return names[i] ?? "anon";
}

export function HomePageContainer() {
  const wallet = useWalletState();
  const contract = useContractState();
  const feed = useFeedQueries();
  const profile = useProfileState();
  const composer = useComposer();
  const { status } = useStatusState();
  const postActions = usePostActionsController();

  const effectiveAuthorIdentity = useMemo(() => {
    // Default behavior (live feed): preserve real author identity map.
    if (!feed.isDemoModeEnabled || feed.isLiveFeedEnabled) return profile.authorIdentity;

    const base = new Map(profile.authorIdentity);

    // Always map connected wallet to a friendly label.
    const walletLower = wallet.walletAddress?.trim().toLowerCase() ?? "";
    if (walletLower) {
      const prefer = profile.profileName?.trim();
      const name = prefer || "You";
      base.set(walletLower, {
        name,
        hue: stableHueFromSeed(walletLower)
      });
    }

    // Mix: some authors show nickname, some show address.
    for (const p of feed.posts) {
      const a = (p.author ?? "").trim().toLowerCase();
      if (!a) continue;
      if (base.has(a) && base.get(a)?.name?.trim()) continue;

      // ~55% of authors get a nickname; the rest remain raw address.
      const shouldName = (hashToInt(a) % 100) < 55;
      if (!shouldName) continue;
      base.set(a, { name: pickDemoName(a), hue: stableHueFromSeed(a) });
    }

    return base;
  }, [feed.isDemoModeEnabled, feed.isLiveFeedEnabled, feed.posts, profile.authorIdentity, profile.profileName, wallet.walletAddress]);

  const viewModel = buildHomePageViewModel({
    isOwner: contract.isOwner,
    selfAvatarHue: profile.selfAvatarHue,
    ipfsConfigured: composer.ipfsConfigured,
    onOpenComposer: composer.openComposer,
    draft: composer.draft,
    isImageLoading: composer.isImageLoading,
    onDraftFieldChange: composer.handleDraftChange,
    onImageUrlChange: composer.onComposerImageUrlChange,
    onSelectFile: composer.onSelectComposerFile,
    onClearImage: composer.onComposerClearImage,
    onPost: composer.mintPost,
    posts: feed.posts,
    chainId: wallet.chainId,
    networkName: wallet.networkName,
    contractAddress: contract.contractAddress,
    contractDeployed: contract.contractDeployed,
    status,
    isFeedLoading: feed.isFeedLoading,
    walletAddress: wallet.walletAddress,
    isDemoModeEnabled: feed.isDemoModeEnabled,
    isLiveFeedEnabled: feed.isLiveFeedEnabled,
    demoStep: feed.demoStep,
    authorIdentity: effectiveAuthorIdentity,
    postActions,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  return <HomePage {...viewModel} />;
}
