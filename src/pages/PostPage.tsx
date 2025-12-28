import type { Draft, Post, PostComment } from "../types";
import { Feed } from "../components/Feed";
import { Link, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { IconRepeat } from "../components/icons";

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
  onSaveEditedPost: () => void;
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
  const [commentDraft, setCommentDraft] = useState<string>("");

  const singlePostList = useMemo(() => (props.post ? [props.post] : []), [props.post]);

  const requiresNetworkSwitch =
    !!props.walletAddress && !!props.chainId && !!props.postChainId && props.postChainId !== props.chainId;
  const interactionDisabledTitle = requiresNetworkSwitch
    ? "Switch networks to interact with this post."
    : undefined;
  const explorerChainId = props.postChainId ?? props.chainId;

  const onSubmitComment = useCallback(async () => {
    const ok = await props.onAction(props.tokenId, "comment", props.postChainId, commentDraft);
    if (ok) setCommentDraft("");
  }, [props, commentDraft]);

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

  const showPostSkeleton = props.isLoadingPost && !props.post;

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
          {props.post ? (
            <Feed
              hideHeader
              singleColumn
              posts={singlePostList}
              isLoading={false}
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
          ) : showPostSkeleton ? (
            <Feed
              hideHeader
              singleColumn
              posts={[]}
              isLoading
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
          ) : (
            <section className="card">
              <div className="cardTitle">{title}</div>
              <div className="muted">Post not found on the current feed.</div>
            </section>
          )}
        </div>

        <div className="postRight">
          <section className="card">
            <div className="postForm">
              <div className="postFormRow">
                <input
                  className="postField"
                  type="text"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Write a comment to sign"
                  disabled={requiresNetworkSwitch}
                  title={interactionDisabledTitle}
                />
                <button
                  className={`secondary${requiresNetworkSwitch ? " notAllowed" : ""}`}
                  type="button"
                  onClick={onSubmitComment}
                  disabled={requiresNetworkSwitch}
                  title={interactionDisabledTitle}
                >
                  Sign
                </button>
              </div>
            </div>

            {props.isLoadingComments && props.comments.length === 0 ? (
              <div className="commentList" aria-busy={true} aria-label="Loading comments" role="status">
                {Array.from({ length: 1 }).map((_, idx) => (
                  <div key={`comment-skeleton-${idx}`} className="commentItem" aria-hidden="true">
                    <div className="avatar tiny skeleton" />
                    <div className="commentMain">
                      <div className="commentMeta">
                        <div className="skeletonLine" style={{ width: "38%" }} />
                      </div>
                      <div className="skeletonLine" style={{ width: "86%" }} />
                      <div className="skeletonLine" style={{ width: "64%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : props.comments.length === 0 ? (
              <div className="commentEmpty">
                <div className="muted">No comments yet.</div>
              </div>
            ) : (
              <div className="commentList">
                {props.comments.map((c, idx) => {
                  const hue = props.stableHueFromSeed(c.commenter.toLowerCase());
                  const label = props.shortAddress(c.commenter);
                  const explorer = c.txHash ? props.getExplorerTxUrl(explorerChainId, c.txHash) : null;
                  return (
                    <div key={`${c.txHash ?? "nohash"}-${c.logIndex ?? idx}`} className="commentItem">
                      <div className="avatar tiny" style={{ background: `hsl(${hue} 75% 55%)` }} />
                      <div className="commentMain">
                        <div className="commentMeta">
                          <span className="commentAuthor">{label}</span>
                          {explorer ? (
                            <a
                              className="commentLink"
                              href={explorer}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="View transaction"
                              title="View transaction"
                            >
                              <IconRepeat size={16} />
                            </a>
                          ) : null}
                        </div>
                        <div className="commentText">{c.comment}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
