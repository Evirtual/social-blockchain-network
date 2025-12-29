import type { Draft, Post } from "@types";
import { Feed } from "../../feed";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminProfileModal } from "../components/AdminProfileModal";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import { FeedHeaderControls } from "../../home/components/FeedHeaderControls";
import { getSupportedNetworks } from "../../home/services/supportedNetworks";
import { filterPosts } from "../../home/services/filterPosts";
import { useSessionStorageState } from "@shared/hooks/useSessionStorageState";

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

  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;

  onSetEditDraft: (next: Draft) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => Promise<void>;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  onTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onBurn: (tokenId: string, postChainId?: string | null) => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

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

  const supportedNetworks = useMemo(() => getSupportedNetworks(), []);
  const defaultSelectedNetworkChainIds = useMemo(
    () => supportedNetworks.map((n) => String(n.chainId)),
    [supportedNetworks]
  );

  const [searchQuery, setSearchQuery] = useSessionStorageState<string>(
    `socialBlockchainNetwork.profile.${profileKey}.searchQuery`,
    "",
    {
      serialize: (v) => String(v ?? ""),
      parse: (raw) => String(raw ?? "")
    }
  );

  const [selectedNetworkChainIds, setSelectedNetworkChainIds, hasStoredSelectedNetworks] = useSessionStorageState<
    string[]
  >(
    `socialBlockchainNetwork.profile.${profileKey}.selectedNetworks`,
    defaultSelectedNetworkChainIds,
    {
      serialize: (v) => JSON.stringify({ ids: v }),
      parse: (raw) => {
        try {
          const parsed = JSON.parse(raw) as any;
          const ids = Array.isArray(parsed?.ids)
            ? parsed.ids.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
            : [];
          return ids;
        } catch {
          return [];
        }
      }
    }
  );

  const didInitDisconnectedNetworksRef = useRef(false);

  useEffect(() => {
    if (props.walletAddress) {
      didInitDisconnectedNetworksRef.current = false;
      return;
    }
    if (didInitDisconnectedNetworksRef.current) return;
    didInitDisconnectedNetworksRef.current = true;
    setSelectedNetworkChainIds(defaultSelectedNetworkChainIds);
  }, [props.walletAddress, defaultSelectedNetworkChainIds, setSelectedNetworkChainIds]);

  useEffect(() => {
    if (hasStoredSelectedNetworks) return;
    if (!props.walletAddress) return;
    const currentChainId = props.chainId ? String(props.chainId) : null;
    if (!currentChainId) return;
    const supported = new Set(supportedNetworks.map((n) => String(n.chainId)));
    if (!supported.has(currentChainId)) return;
    setSelectedNetworkChainIds([currentChainId]);
  }, [
    hasStoredSelectedNetworks,
    props.walletAddress,
    props.chainId,
    supportedNetworks,
    setSelectedNetworkChainIds
  ]);

  const canAdminEdit = props.isOwner && (!props.walletAddress || props.walletAddress.toLowerCase() !== props.address.toLowerCase());
  // Match Approvals modal semantics: unknown => treated as not allowed (Approve visible).
  const isAllowed = props.isPosterAllowed === true;
  const [isAdminEditing, setIsAdminEditing] = useState(false);

  const initialDraft = useMemo(
    () => ({ name: props.name ?? "", bio: props.bio ?? "", avatarUrl: props.avatarUrl ?? "" }),
    [props.name, props.bio, props.avatarUrl]
  );

  const activePosts = useMemo(() => props.posts.map((p) => ({ ...p, contextTag: undefined })), [props.posts]);
  const activeLoading = props.isFeedLoading;
  const activeTitle = "Profile Feed";

  const filteredPosts = useMemo(() => {
    return filterPosts({
      posts: activePosts,
      authorIdentity: props.authorIdentity,
      shortAddress: props.shortAddress,
      searchQuery,
      selectedNetworkChainIds
    });
  }, [activePosts, props.authorIdentity, props.shortAddress, searchQuery, selectedNetworkChainIds]);

  const isNetworkFilterActive = useMemo(() => {
    const all = new Set(supportedNetworks.map((n) => String(n.chainId)));
    const selected = new Set(selectedNetworkChainIds.map(String));
    if (selected.size !== all.size) return true;
    for (const id of selected) {
      if (!all.has(id)) return true;
    }
    return false;
  }, [selectedNetworkChainIds, supportedNetworks]);

  const hasAnyFilter = !!searchQuery.trim() || isNetworkFilterActive;
  const pillText = hasAnyFilter ? `${filteredPosts.length} / ${activePosts.length} posts` : `${activePosts.length} posts`;

  return (
    <main className="profileLayout">
      <section className="profileTop profileTopSingle">
        <ProfileHeaderCard
          canAdminEdit={canAdminEdit}
          wasPosterDisapprovedEver={props.wasPosterDisapprovedEver}
          isAllowed={isAllowed}
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
          onSave={(next) => props.onAdminSetProfile(next)}
        />
      ) : null}

      <section className="content">
        <Feed
          title={activeTitle}
          pillText=""
          headerAction={
            <FeedHeaderControls
              pillText={pillText}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              selectedNetworkChainIds={selectedNetworkChainIds}
              onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
              supportedNetworks={supportedNetworks}
            />
          }
          isLoading={activeLoading}
          loadingText={props.status}
          posts={filteredPosts}
          isOwner={props.isOwner}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          authorIdentity={props.authorIdentity}
          editingTokenId={props.editingTokenId}
          editDraft={props.editDraft}
          isEditImageLoading={props.isEditImageLoading}
          onSetEditDraft={props.onSetEditDraft}
          onStartEditPost={props.onStartEditPost}
          onCancelEditPost={props.onCancelEditPost}
          onSaveEditedPost={props.onSaveEditedPost}
          onEditSelectFile={props.onEditSelectFile}
          onEditClearImage={props.onEditClearImage}
          onAction={props.onAction}
          onTip={props.onTip}
          onBurn={props.onBurn}
          onFreezePost={props.onFreezePost}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getNativeSymbol={props.getNativeSymbol}
          getExplorerTxUrl={props.getExplorerTxUrl}
        />
      </section>
    </main>
  );
}
