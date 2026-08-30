import type { Post } from "@types";
import { PostCard } from "../../../post/components/PostCard";
import type { PostPanel } from "../../../post/components/postCard/postPanel";
import type { PostActionsController } from "../../../post/types";
import type { PostFeedEntry } from "@features/post/types";
import { FeedSkeleton } from "./FeedSkeleton";

type Props = {
  posts: Post[];
  isLoading?: boolean;
  showSkeletons: boolean;
  skeletonCount: number;
  singleColumn?: boolean;
  chainId: string | null;
  walletAddress: string | null;
  from: string;
  postActions: PostActionsController;
  postEntries: PostFeedEntry[];
  panelById: Record<string, PostPanel | null | undefined>;
  togglePanel: (id: string, panel: PostPanel) => void;
};

export function FeedPostList(props: Props) {
  return (
    <div
      className={props.singleColumn ? "posts postsSingle" : "posts"}
      aria-busy={props.isLoading ? true : undefined}
      aria-label={props.isLoading ? "Loading posts" : undefined}
      role={props.isLoading && props.posts.length === 0 ? "status" : undefined}
    >
      {props.postEntries.map((entry, index) => {
        const openPanel = props.panelById[entry.panelKey] ?? null;
        const isEditing = props.postActions.editingTokenId === entry.panelKey;

        return (
          <PostCard
            key={entry.compositeKey}
            post={entry.post}
            animationDelayMs={index * 80}
            from={props.from}
            chainId={props.chainId}
            walletAddress={props.walletAddress}
            authorLabel={entry.author.authorLabel}
            authorHue={entry.author.authorHue}
            authorAvatarUrl={entry.author.authorAvatarUrl}
            isMine={entry.isMine}
            canModerate={entry.canModerate}
            isEditing={isEditing}
            editDraft={isEditing ? props.postActions.editDraft : null}
            isEditImageLoading={isEditing ? props.postActions.isEditImageLoading : false}
            openPanel={openPanel}
            panelKey={entry.panelKey}
            togglePanel={props.togglePanel}
            onSetEditDraft={props.postActions.onSetEditDraft}
            onStartEditPost={props.postActions.onStartEditPost}
            onCancelEditPost={props.postActions.onCancelEditPost}
            onSaveEditedPost={props.postActions.onSaveEditedPost}
            onEditSelectFile={props.postActions.onEditSelectFile}
            onEditClearImage={props.postActions.onEditClearImage}
            onAction={props.postActions.onAction}
            onTip={props.postActions.onTip}
            onReply={props.postActions.replyToComment}
            onEditComment={props.postActions.editComment}
            onDeleteComment={props.postActions.deleteComment}
            onToggleCommentLike={props.postActions.toggleCommentLike}
            onToggleCommentSave={props.postActions.toggleCommentSave}
            onTipComment={props.postActions.tipComment}
            onReportPost={props.postActions.reportPost}
            onReportComment={props.postActions.reportComment}
            onBurn={props.postActions.onBurn}
            onFreezePost={props.postActions.onFreezePost}
          />
        );
      })}

      {props.showSkeletons ? <FeedSkeleton count={props.skeletonCount} /> : null}
    </div>
  );
}
