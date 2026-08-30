import type { Post } from "@types";
import { PostCard } from "@features/post/components/PostCard";
import type { PostPanel } from "@features/post/components/postCard/postPanel";
import type { PostActionsController } from "@features/post/types";
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
            openPanel={openPanel}
            panelKey={entry.panelKey}
            postActions={props.postActions}
            togglePanel={props.togglePanel}
          />
        );
      })}

      {props.showSkeletons ? <FeedSkeleton count={props.skeletonCount} /> : null}
    </div>
  );
}
