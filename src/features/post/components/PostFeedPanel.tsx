import type { Post } from "@types";
import { Feed } from "@features/feed";
import type { PostActionsController } from "@features/post";

type Props = {
  title: string;
  post: Readonly<Post> | null;
  isLoadingPost: boolean;

  isOwner: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  postActions: PostActionsController;

};

export function PostFeedPanel(props: Props) {
  const showPostSkeleton = props.isLoadingPost && !props.post;
  const singlePostList = props.post ? [props.post] : [];

  if (props.post) {
    return (
      <Feed
        hideHeader
        singleColumn
        posts={singlePostList}
        isLoading={false}
        isOwner={props.isOwner}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        authorIdentity={props.authorIdentity}
        postActions={props.postActions}
      />
    );
  }

  if (showPostSkeleton) {
    return (
      <Feed
        hideHeader
        singleColumn
        posts={[]}
        isLoading
        isOwner={props.isOwner}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        authorIdentity={props.authorIdentity}
        postActions={props.postActions}
      />
    );
  }

  return (
    <section className="card">
      <div className="cardTitle">{props.title}</div>
      <div className="muted">Post not found on the current feed.</div>
    </section>
  );
}
