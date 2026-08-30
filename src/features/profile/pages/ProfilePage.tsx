import type { Post } from "@types";
import { useMemo, useState } from "react";
import { ProfileAdminPanel } from "../components/ProfileAdminPanel";
import { ProfileFeedSection } from "../components/ProfileFeedSection";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import type { PostActionsController } from "@features/post/types";
import { getAvatarStyle } from "@shared/lib/avatar";
import { shortAddress } from "@shared/lib/format";

type Props = {
  isOwner: boolean;
  address: string;
  name: string;
  bio: string;
  avatarHue: number;
  avatarUrl?: string;

  isPosterAllowed?: boolean;
  wasPosterDisapprovedEver?: boolean;
  adminActionInFlight?: "approve" | "disapprove" | "reset" | "save" | null;
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
  isFollowSubmitting?: boolean;
  onToggleFollow: () => void;

  posts: Post[];
  chainId: string | null;
  status: string;
  isFeedLoading: boolean;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  postActions: PostActionsController;

};

export function ProfilePage(props: Props) {
  const addressLabel = shortAddress(props.address);

  const canFollow = !!props.walletAddress && props.walletAddress.toLowerCase() !== props.address.toLowerCase();

  const isFollowing = props.isFollowing;

  const showFollowButton = canFollow;

  const canAdminEdit = props.isOwner && (!props.walletAddress || props.walletAddress.toLowerCase() !== props.address.toLowerCase());
  const [isAdminEditing, setIsAdminEditing] = useState(false);

  const initialDraft = useMemo(
    () => ({ name: props.name ?? "", bio: props.bio ?? "", avatarUrl: props.avatarUrl ?? "" }),
    [props.name, props.bio, props.avatarUrl]
  );
  const avatarStyle = useMemo(
    () => getAvatarStyle({ avatarUrl: props.avatarUrl, hue: props.avatarHue }),
    [props.avatarUrl, props.avatarHue]
  );

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
          adminActionInFlight={props.adminActionInFlight}
          canFollow={showFollowButton}
          isFollowing={isFollowing}
          isFollowSubmitting={props.isFollowSubmitting}
          onToggleFollow={props.onToggleFollow}
          name={props.name}
          addressLabel={addressLabel}
          bio={props.bio}
          avatarHue={props.avatarHue}
          avatarUrl={props.avatarUrl}
        />
      </section>

      <ProfileAdminPanel
        canAdminEdit={canAdminEdit}
        isAdminEditing={isAdminEditing}
        onClose={() => setIsAdminEditing(false)}
        initialDraft={initialDraft}
        avatarStyle={avatarStyle}
        isSaving={props.adminActionInFlight === "save"}
        onSave={props.onAdminSetProfile}
      />

      <ProfileFeedSection
        posts={props.posts}
        authorIdentity={props.authorIdentity}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        isFeedLoading={props.isFeedLoading}
        status={props.status}
        isOwner={props.isOwner}
        postActions={props.postActions}
        authorAddress={props.address}
      />
    </main>
  );
}
