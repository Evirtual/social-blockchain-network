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

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
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
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getNativeSymbol={props.getNativeSymbol}
        getExplorerTxUrl={props.getExplorerTxUrl}
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
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getNativeSymbol={props.getNativeSymbol}
        getExplorerTxUrl={props.getExplorerTxUrl}
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
