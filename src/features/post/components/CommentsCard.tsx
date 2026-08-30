import type { PostComment } from "@types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getPostNetworkUi } from "@shared/lib/network";
import { useContractState } from "../../contract/providers/useContractState";
import { profileKey } from "../../profile/lib/profileKey";
import { useProfileActions } from "../../profile/providers/useProfileActions";
import { useProfileState } from "../../profile/providers/useProfileState";
import { CommentItem } from "./comments/CommentItem";
import { NewCommentComposer } from "./comments/NewCommentComposer";
import type { ActionInFlight, ActiveComposer } from "./comments/types";
import { shortAddress } from "@shared/lib/format";
import { getNativeSymbol } from "@shared/lib/chain";

type Props = {
  tokenId: string;
  postChainId: string | null;
  chainId: string | null;
  walletAddress: string | null;
  useCardWrapper?: boolean;
  allowCommenting?: boolean;
  forceReadOnly?: boolean;
  disableAuthorProfileLookup?: boolean;
  canModerateComments?: boolean;

  comments: ReadonlyArray<PostComment>;
  isLoadingComments: boolean;

  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onDeleteComment: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentLike: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentSave: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (
    tokenId: string,
    commentId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<boolean>;
  onReportPost: (tokenId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;

};

export function CommentsCard(props: Props) {
  const location = useLocation();
  const contractState = useContractState();
  const profileState = useProfileState();
  const profileActions = useProfileActions();

  const lastHashScroll = useRef<string>("");

  const [commentDraft, setCommentDraft] = useState<string>("");
  const [activeComposer, setActiveComposer] = useState<ActiveComposer>({ type: null });
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({});
  const [tipSupportBpsDrafts, setTipSupportBpsDrafts] = useState<Record<string, number | null>>({});
  const [tipSavePreferenceDrafts, setTipSavePreferenceDrafts] = useState<Record<string, boolean>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({});
  const [isSigning, setIsSigning] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<ActionInFlight>({
    id: null,
    action: null
  });

  const { requiresNetworkSwitch: baseRequiresNetworkSwitch, interactionDisabledTitle: baseInteractionDisabledTitle } =
    getPostNetworkUi({
    postChainId: props.postChainId,
    chainId: props.chainId,
    walletAddress: props.walletAddress
  });

  const requiresNetworkSwitch = props.forceReadOnly ? true : baseRequiresNetworkSwitch;
  const interactionDisabledTitle = props.forceReadOnly
    ? "Connect and get approved to interact."
    : baseInteractionDisabledTitle;

  const explorerChainId = props.postChainId ?? props.chainId;
  const nativeSymbol = getNativeSymbol(explorerChainId);
  const walletLower = props.walletAddress?.toLowerCase() ?? null;
  const defaultSupportBps = contractState.tipSupportPreferenceBps || 0;

  const visibleComments = useMemo(() => props.comments.filter((comment) => !comment.deleted), [props.comments]);

  const missingCommentAuthors = useMemo(() => {
    if (props.disableAuthorProfileLookup) return [];
    const resolvedChainId = explorerChainId;
    if (!resolvedChainId) return [];
    const unique = Array.from(
      new Set(visibleComments.map((c) => (c.author ? c.author.toLowerCase() : "")).filter(Boolean))
    );
    if (unique.length === 0) return [];
    return unique.filter((addr) => !profileState.profilesByAddress[profileKey(resolvedChainId, addr)]);
  }, [props.disableAuthorProfileLookup, visibleComments, profileState.profilesByAddress, explorerChainId]);

  useEffect(() => {
    if (props.disableAuthorProfileLookup) return;
    if (missingCommentAuthors.length === 0) return;
    const resolvedChainId = explorerChainId;
    if (!resolvedChainId) return;

    const limit = Math.max(1, Math.min(4, missingCommentAuthors.length));
    let next = 0;

    let active = true;

    const task = async () => {
      const workers = Array.from({ length: limit }, async () => {
        while (true) {
          const i = next++;
          if (i >= missingCommentAuthors.length) break;

          const addr = missingCommentAuthors[i];
          if (!addr) continue;
          try {
            // Reuse the Profile feature loader (deduped + gated).
            await profileActions.loadProfile(addr, resolvedChainId);
          } catch {
            // ignore
          }
          if (!active) return;
        }
      });
      await Promise.all(workers);
    };

    void task();

    return () => {
      active = false;
    };
  }, [missingCommentAuthors, explorerChainId, props.disableAuthorProfileLookup, profileActions]);

  useEffect(() => {
    const hash = String(location.hash ?? "").trim();
    if (!hash || !hash.startsWith("#comment-")) return;
    if (hash === lastHashScroll.current) return;
    if (props.isLoadingComments) return;
    if (!props.comments.length) return;

    const id = hash.slice(1);
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      lastHashScroll.current = hash;
      el.scrollIntoView({ block: "center" });
    }, 50);

    return () => window.clearTimeout(t);
  }, [location.hash, props.isLoadingComments, props.comments.length]);

  const getDisplayProfile = useCallback(
    (address: string) => {
      // Every comment here belongs to one post, so they all share its chain.
      return profileState.profilesByAddress[profileKey(explorerChainId, address)];
    },
    [profileState.profilesByAddress, explorerChainId]
  );

  const getDisplayName = useCallback(
    (address: string) => {
      const profile = getDisplayProfile(address);
      return profile?.name?.trim() ? profile.name : shortAddress(address);
    },
    [getDisplayProfile]
  );

  const getDisplayAvatarUrl = useCallback(
    (address: string) => {
      const profile = getDisplayProfile(address);
      return profile?.avatarUrl?.trim() ? profile.avatarUrl : undefined;
    },
    [getDisplayProfile]
  );
  const { rootIdById, authorById } = useMemo(() => {
    const commentIds = new Set<string>();
    const parentById = new Map<string, string | null>();
    const authorMap = new Map<string, string>();
    visibleComments.forEach((comment) => {
      commentIds.add(comment.commentId);
      parentById.set(comment.commentId, comment.parentId ?? null);
      authorMap.set(comment.commentId, comment.author);
    });

    const rootMap = new Map<string, string>();
    visibleComments.forEach((comment) => {
      let current = comment.commentId;
      let parent = parentById.get(current);
      let guard = 0;
      while (parent && commentIds.has(parent) && guard < 10) {
        current = parent;
        parent = parentById.get(current) ?? null;
        guard += 1;
      }
      rootMap.set(comment.commentId, current);
    });

    return { rootIdById: rootMap, authorById: authorMap };
  }, [visibleComments]);

  const rootComments = useMemo(
    () => visibleComments.filter((comment) => rootIdById.get(comment.commentId) === comment.commentId),
    [visibleComments, rootIdById]
  );

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

  const wrapperClassName = props.useCardWrapper === false ? undefined : "";

  const allowCommenting = props.forceReadOnly ? false : (props.allowCommenting ?? !requiresNetworkSwitch);

  return (
    <section className={wrapperClassName}>
      {allowCommenting ? (
        <NewCommentComposer
          value={commentDraft}
          onChange={setCommentDraft}
          onSubmit={onSubmitComment}
          isSigning={isSigning}
          requiresNetworkSwitch={requiresNetworkSwitch}
          interactionDisabledTitle={interactionDisabledTitle}
        />
      ) : null}

      {props.isLoadingComments && props.comments.length === 0 ? (
        <div className="commentList" aria-busy={true} aria-label="Loading comments" role="status">
          {Array.from({ length: 1 }).map((_, idx) => (
            <article key={`comment-skeleton-${idx}`} className="post postSkeleton comment" aria-hidden="true">
              <div className="postHead">
                <div className="avatar small skeleton" />
                <div className="postHeadMain">
                  <div className="postHeadTop">
                    <div className="skeletonLine" style={{ width: "40%" }} />
                    <div className="skeletonLine" style={{ width: "22%" }} />
                  </div>
                </div>
              </div>

              <div className="post-body">
                <div className="skeletonLine" style={{ width: "92%" }} />
                <div className="skeletonLine" style={{ width: "84%" }} />
                <div className="skeletonLine" style={{ width: "66%" }} />
              </div>
            </article>
          ))}
        </div>
      ) : visibleComments.length === 0 ? (
        <div className="commentEmpty">
          <div className="muted">No comments yet.</div>
        </div>
      ) : (
        <div className="commentList">
          {rootComments.map((c, idx) => {
            const replies = visibleComments.filter(
              (comment) => rootIdById.get(comment.commentId) === c.commentId && comment.parentId
            );
            return (
              <article
                key={c.commentId ?? `${c.txHash ?? "nohash"}-${c.logIndex ?? idx}`}
                id={c.commentId ? `comment-${c.commentId}` : undefined}
                className="post comment"
              >
                <CommentItem
                  comment={c}
                  defaultSupportBps={defaultSupportBps}
                  authorLabel={getDisplayName(c.author)}
                  authorAvatarUrl={getDisplayAvatarUrl(c.author)}
                  tokenId={props.tokenId}
                  postChainId={props.postChainId}
                  explorerChainId={explorerChainId}
                  nativeSymbol={nativeSymbol}
                  walletLower={walletLower}
                  canModerateComments={props.canModerateComments}
                  requiresNetworkSwitch={requiresNetworkSwitch}
                  interactionDisabledTitle={interactionDisabledTitle}
                  isSigning={isSigning}
                  activeComposer={activeComposer}
                  setActiveComposer={setActiveComposer}
                  replyDrafts={replyDrafts}
                  setReplyDrafts={setReplyDrafts}
                  editDrafts={editDrafts}
                  setEditDrafts={setEditDrafts}
                  tipDrafts={tipDrafts}
                  setTipDrafts={setTipDrafts}
                  tipSupportBpsDrafts={tipSupportBpsDrafts}
                  setTipSupportBpsDrafts={setTipSupportBpsDrafts}
                  tipSavePreferenceDrafts={tipSavePreferenceDrafts}
                  setTipSavePreferenceDrafts={setTipSavePreferenceDrafts}
                  reportDrafts={reportDrafts}
                  setReportDrafts={setReportDrafts}
                  actionInFlight={actionInFlight}
                  setActionInFlight={setActionInFlight}
                  onReply={props.onReply}
                  onEditComment={props.onEditComment}
                  onDeleteComment={props.onDeleteComment}
                  onToggleCommentLike={props.onToggleCommentLike}
                  onToggleCommentSave={props.onToggleCommentSave}
                  onTipComment={props.onTipComment}
                  onReportComment={props.onReportComment}
                />
                {replies.length ? (
                  <div className="commentReplies">
                    {replies.map((reply, replyIdx) => (
                      <div
                        key={reply.commentId ?? `${reply.txHash ?? "nohash"}-${reply.logIndex ?? replyIdx}`}
                        id={reply.commentId ? `comment-${reply.commentId}` : undefined}
                        className="commentReply"
                      >
                        <CommentItem
                          comment={reply}
                          defaultSupportBps={defaultSupportBps}
                          replyToAddress={reply.parentId ? authorById.get(reply.parentId) ?? reply.parentId : null}
                          replyToLabel={
                            reply.parentId
                              ? getDisplayName(authorById.get(reply.parentId) ?? reply.parentId)
                              : null
                          }
                          authorLabel={getDisplayName(reply.author)}
                          authorAvatarUrl={getDisplayAvatarUrl(reply.author)}
                          tokenId={props.tokenId}
                          postChainId={props.postChainId}
                          explorerChainId={explorerChainId}
                          nativeSymbol={nativeSymbol}
                          walletLower={walletLower}
                          canModerateComments={props.canModerateComments}
                          requiresNetworkSwitch={requiresNetworkSwitch}
                          interactionDisabledTitle={interactionDisabledTitle}
                          isSigning={isSigning}
                          activeComposer={activeComposer}
                          setActiveComposer={setActiveComposer}
                          replyDrafts={replyDrafts}
                          setReplyDrafts={setReplyDrafts}
                          editDrafts={editDrafts}
                          setEditDrafts={setEditDrafts}
                          tipDrafts={tipDrafts}
                          setTipDrafts={setTipDrafts}
                          tipSupportBpsDrafts={tipSupportBpsDrafts}
                          setTipSupportBpsDrafts={setTipSupportBpsDrafts}
                          tipSavePreferenceDrafts={tipSavePreferenceDrafts}
                          setTipSavePreferenceDrafts={setTipSavePreferenceDrafts}
                          reportDrafts={reportDrafts}
                          setReportDrafts={setReportDrafts}
                          actionInFlight={actionInFlight}
                          setActionInFlight={setActionInFlight}
                          onReply={props.onReply}
                          onEditComment={props.onEditComment}
                          onDeleteComment={props.onDeleteComment}
                          onToggleCommentLike={props.onToggleCommentLike}
                          onToggleCommentSave={props.onToggleCommentSave}
                          onTipComment={props.onTipComment}
                          onReportComment={props.onReportComment}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
