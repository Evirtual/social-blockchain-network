import type { PostComment } from "@types";
import { useCallback, useState } from "react";
import { IconRepeat } from "@features/app";
import { getPostNetworkUi } from "@shared/lib/network";

type Props = {
  tokenId: string;
  postChainId: string | null;
  chainId: string | null;
  walletAddress: string | null;
  useCardWrapper?: boolean;
  allowCommenting?: boolean;

  comments: PostComment[];
  isLoadingComments: boolean;

  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function CommentsCard(props: Props) {
  const [commentDraft, setCommentDraft] = useState<string>("");
  const [isSigning, setIsSigning] = useState(false);

  const { requiresNetworkSwitch, interactionDisabledTitle } = getPostNetworkUi({
    postChainId: props.postChainId,
    chainId: props.chainId,
    walletAddress: props.walletAddress
  });

  const explorerChainId = props.postChainId ?? props.chainId;

  const onSubmitComment = useCallback(async () => {
    if (isSigning) return;
    setIsSigning(true);
    try {
      const ok = await props.onAction(props.tokenId, "comment", props.postChainId, commentDraft);
      if (ok) setCommentDraft("");
    } finally {
      setIsSigning(false);
    }
  }, [props, commentDraft, isSigning]);

  const wrapperClassName = props.useCardWrapper === false ? undefined : "card";

  const allowCommenting = props.allowCommenting ?? !requiresNetworkSwitch;

  return (
    <section className={wrapperClassName}>
      {allowCommenting ? (
        <div className="postForm">
          <div className="postFormRow">
            <input
              className="postField"
              type="text"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write a comment to sign"
              disabled={isSigning}
              title={interactionDisabledTitle}
            />
            <button
              className={`secondary buttonWithSpinner${requiresNetworkSwitch ? " notAllowed" : ""}`}
              type="button"
              onClick={onSubmitComment}
              disabled={isSigning}
              title={interactionDisabledTitle}
            >
              {isSigning ? <span className="spinner" aria-hidden="true" /> : null}
              Sign
            </button>
          </div>
        </div>
      ) : null}

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
  );
}
