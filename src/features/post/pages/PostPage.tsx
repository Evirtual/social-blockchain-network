import type { Draft, Post, PostComment } from "@types";
import { Link, useLocation } from "react-router-dom";
import { CommentsCard, PostFeedPanel } from "../components";

type Props = {
  isOwner: boolean;
  tokenId: string;
  postChainId: string | null;
  post: Post | null;
  isLoadingPost: boolean;
  comments: PostComment[];
  isLoadingComments: boolean;

  posts: Post[];
  chainId: string | null;
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

export function PostPage(props: Props) {
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from;
  const current = `${location.pathname}${location.search}`;
  const safeFrom =
    typeof from === "string" &&
    from.length > 0 &&
    from.startsWith("/") &&
    from !== current &&
    !from.startsWith("/post/")
      ? from
      : "/";

  const title = props.post ? `Post #${props.post.tokenId}` : `Post #${props.tokenId}`;

  return (
    <main className="home">
      <div className="pageHeader">
        <Link className="btn ghost" to={safeFrom} replace>
          ← Home
        </Link>
        <div className="pageHeaderTitle">{title}</div>
      </div>

      <div className="postSplit">
        <div className="postLeft">
          <PostFeedPanel
            title={title}
            post={props.post}
            isLoadingPost={props.isLoadingPost}
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
        </div>

        <div className="postRight">
          <CommentsCard
            tokenId={props.tokenId}
            postChainId={props.postChainId}
            chainId={props.chainId}
            walletAddress={props.walletAddress}
            comments={props.comments}
            isLoadingComments={props.isLoadingComments}
            onAction={props.onAction}
            shortAddress={props.shortAddress}
            stableHueFromSeed={props.stableHueFromSeed}
            getExplorerTxUrl={props.getExplorerTxUrl}
          />
        </div>
      </div>
    </main>
  );
}
