import type { Post } from "@types";
import { Feed } from "@features/feed";
import { useMemo, useState } from "react";
import { AdminProfileModal } from "../components/AdminProfileModal";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import { FeedHeaderControls } from "@features/home/components/FeedHeaderControls";
import { useFeedFilterViewModel } from "@features/home/hooks/useFeedFilterViewModel";
import { ipfsToHttp } from "@features/ipfs";
import type { PostActionsController } from "@features/post";

type Props = {
  isOwner: boolean;
  address: string;
  name: string;
  bio: string;
  avatarHue: number;
  avatarUrl?: string;

  isPosterAllowed?: boolean;
  wasPosterDisapprovedEver?: boolean;
  onAdminSetPosterAllowed: (allowed: boolean) => void;
  onAdminReset: () => void;
  onAdminSetProfile: (next: {
    name: string;
    bio: string;
    avatarUrl: string;
    avatarFile?: File | null;
    avatarFilename?: string;
    avatarDataUrl?: string;
  }) => void;

  isFollowing: boolean | undefined;
  onToggleFollow: () => void;

  posts: Post[];
  chainId: string | null;
  status: string;
  isFeedLoading: boolean;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  postActions: PostActionsController;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function ProfilePage(props: Props) {
  const addressLabel = props.shortAddress(props.address);
  const canFollow =
    !!props.walletAddress && props.walletAddress.toLowerCase() !== props.address.toLowerCase();

  const profileKey = String(props.address ?? "").trim().toLowerCase();

  const canAdminEdit = props.isOwner && (!props.walletAddress || props.walletAddress.toLowerCase() !== props.address.toLowerCase());
  const [isAdminEditing, setIsAdminEditing] = useState(false);

  const initialDraft = useMemo(
    () => ({ name: props.name ?? "", bio: props.bio ?? "", avatarUrl: props.avatarUrl ?? "" }),
    [props.name, props.bio, props.avatarUrl]
  );
  const avatarStyle = useMemo(() => {
    if (props.avatarUrl?.trim()) {
      return { backgroundImage: `url(${ipfsToHttp(props.avatarUrl)})` };
    }
    return { background: `hsl(${props.avatarHue} 75% 55%)` };
  }, [props.avatarUrl, props.avatarHue]);

  const activePosts = useMemo(() => props.posts.map((p) => ({ ...p, contextTag: undefined })), [props.posts]);
  const activeLoading = props.isFeedLoading;
  const activeTitle = "Profile Feed";

  const {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    filteredPosts,
    pillText
  } = useFeedFilterViewModel({
    posts: activePosts,
    authorIdentity: props.authorIdentity,
    shortAddress: props.shortAddress,
    searchQueryKey: `socialBlockchainNetwork.profile.${profileKey}.searchQuery`,
    selectedNetworksKey: `socialBlockchainNetwork.profile.${profileKey}.selectedNetworks`,
    walletAddress: props.walletAddress,
    chainId: props.chainId
  });

  const headerAction = useMemo(() => {
    return (
      <FeedHeaderControls
        pillText={pillText}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    );
  }, [pillText, searchQuery, setSearchQuery, selectedNetworkChainIds, setSelectedNetworkChainIds, supportedNetworks]);

  return (
    <main className="profileLayout">
      <section className="profileTop profileTopSingle">
        <ProfileHeaderCard
          canAdminEdit={canAdminEdit}
          wasPosterDisapprovedEver={props.wasPosterDisapprovedEver}
          isPosterAllowed={props.isPosterAllowed}
          isAdminEditing={isAdminEditing}
          onToggleAdminEdit={() => setIsAdminEditing((v) => !v)}
          onAdminSetPosterAllowed={props.onAdminSetPosterAllowed}
          onAdminReset={props.onAdminReset}
          canFollow={canFollow}
          isFollowing={props.isFollowing}
          onToggleFollow={props.onToggleFollow}
          name={props.name}
          addressLabel={addressLabel}
          bio={props.bio}
          avatarHue={props.avatarHue}
          avatarUrl={props.avatarUrl}
        />
      </section>

      {canAdminEdit ? (
        <AdminProfileModal
          open={isAdminEditing}
          onClose={() => setIsAdminEditing(false)}
          initialDraft={initialDraft}
          headerLeading={<div className="avatar small" style={avatarStyle} />}
          onSave={(next) => props.onAdminSetProfile(next)}
        />
      ) : null}

      <section className="content">
        <Feed
          title={activeTitle}
          pillText=""
          headerAction={headerAction}
          isLoading={activeLoading}
          loadingText={props.status}
          posts={filteredPosts}
          isOwner={props.isOwner}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          authorIdentity={props.authorIdentity}
          postActions={props.postActions}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getNativeSymbol={props.getNativeSymbol}
          getExplorerTxUrl={props.getExplorerTxUrl}
        />
      </section>
    </main>
  );
}
