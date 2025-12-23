import type { Draft, Post, PostComment } from "../types";
import { Feed } from "../components/Feed";
import { Link, useLocation } from "react-router-dom";

type Props = {
  tokenId: string;
  post: Post | null;
  comments: PostComment[];
  isLoadingComments: boolean;

  posts: Post[];
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  tipDrafts: Record<string, string>;
  commentDrafts: Record<string, string>;

  onSetEditDraft: (next: Draft) => void;
  onTipDraftChange: (tokenId: string, value: string) => void;
  onCommentDraftChange: (tokenId: string, value: string) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => void;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

  onAction: (tokenId: string, action: "like" | "comment" | "share") => void;
  onTip: (tokenId: string) => void;
  onBurn: (tokenId: string) => void;
  onFreezePost: (tokenId: string) => void;

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
          {props.post ? (
            <Feed
              hideHeader
              singleColumn
              posts={[props.post]}
              chainId={props.chainId}
              walletAddress={props.walletAddress}
              authorIdentity={props.authorIdentity}
              editingTokenId={props.editingTokenId}
              editDraft={props.editDraft}
              isEditImageLoading={props.isEditImageLoading}
              tipDrafts={props.tipDrafts}
              commentDrafts={props.commentDrafts}
              onSetEditDraft={props.onSetEditDraft}
              onTipDraftChange={props.onTipDraftChange}
              onCommentDraftChange={props.onCommentDraftChange}
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
            <div className="cardTitle">Comments</div>
            <div className="postForm">
              <div className="postFormRow">
                <input
                  className="postField"
                  type="text"
                  value={props.commentDrafts[props.tokenId] || ""}
                  onChange={(event) => props.onCommentDraftChange(props.tokenId, event.target.value)}
                  placeholder="Write a comment to sign"
                />
                <button className="secondary" type="button" onClick={() => props.onAction(props.tokenId, "comment")}>
                  Sign
                </button>
              </div>
            </div>

            {props.isLoadingComments && props.comments.length === 0 ? (
              <div className="muted">Loading comments…</div>
            ) : null}

            {!props.isLoadingComments && props.comments.length === 0 ? (
              <div className="muted">No comments yet.</div>
            ) : (
              <div className="commentList">
                {props.comments.map((c, idx) => {
                  const hue = props.stableHueFromSeed(c.commenter.toLowerCase());
                  const label = props.shortAddress(c.commenter);
                  const explorer = c.txHash ? props.getExplorerTxUrl(props.chainId, c.txHash) : null;
                  return (
                    <div key={`${c.txHash ?? "nohash"}-${idx}`} className="commentItem">
                      <div className="avatar small" style={{ background: `hsl(${hue} 75% 55%)` }} />
                      <div className="commentMain">
                        <div className="commentMeta">
                          <span className="commentAuthor">{label}</span>
                          {explorer ? (
                            <a className="commentLink" href={explorer} target="_blank" rel="noreferrer">
                              tx
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
