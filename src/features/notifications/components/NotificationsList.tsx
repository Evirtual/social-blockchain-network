import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatEther } from "ethers";
import { getAvatarStyle } from "@shared/lib/avatar";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { getProfileUrl } from "@shared/lib/profile";
import { postKeyFromParts } from "@shared/lib/post";
import type { Post } from "@types";
import { useFeedActions, useFeedState } from "@features/feed";
import { ipfsToHttp } from "@features/ipfs";
import { getNativeSymbol } from "@shared/lib/network";
import {
  IconBookmark,
  IconCheck,
  IconCoin,
  IconEdit,
  IconEye,
  IconFlag,
  IconHeart,
  IconMessage,
  IconQuestion,
  IconRepeat,
  IconTrash,
  IconX
} from "@shared/components/icons";
import type { NotificationItem } from "../types";
import { notificationActionText } from "../lib/notificationText";

type Props = {
  items: NotificationItem[];
  lastSeenTs: number;
  chainId: string | null;
  onSelect: (notification: NotificationItem, to: string) => void;
};

function formatAmountWei(amountWei: bigint, nativeSymbol: string): string {
  if (!amountWei || amountWei === 0n) return `0.00 ${nativeSymbol}`;
  const raw = formatEther(amountWei);
  const trimmed = raw.includes(".") ? raw.replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1") : raw;
  return `${trimmed} ${nativeSymbol}`;
}

function formatBps(supportBps: number): string {
  if (!Number.isFinite(supportBps) || supportBps <= 0) return "0%";
  const pct = supportBps / 100;
  // Keep it short: 250 bps => 2.5%
  const s = String(pct);
  return s.includes(".") ? `${s.replace(/0+$/, "").replace(/\.$/, "")} %`.replace(" %", "%") : `${s}%`;
}

function isAmountKind(kind: string): boolean {
  return (
    kind === "POST_TIPPED" ||
    kind === "COMMENT_TIPPED" ||
    kind === "PROTOCOL_SUPPORTED" ||
    kind === "WITHDRAW_FEE_PAID"
  );
}

function getKindClass(kind: string): string {
  if (kind === "FOLLOWED" || kind === "UNFOLLOWED") return "isFollow";
  if (kind.includes("LIKED") || kind.includes("UNLIKED")) return "isLike";
  if (kind.includes("SAVED") || kind.includes("UNSAVED")) return "isSave";
  if (kind.includes("COMMENT")) return "isComment";
  if (kind.includes("TIPPED")) return "isTip";
  if (kind.includes("PROTOCOL") || kind.includes("FEE")) return "isTip";
  if (kind.includes("APPROVAL") || kind.includes("APPROVED") || kind.includes("DISAPPROVED")) return "isApproval";
  if (kind.includes("REPORTED")) return "isReport";
  if (kind.includes("REMOVED")) return "isRemove";
  if (kind.includes("PROFILE") || kind.includes("ADMIN") || kind.includes("FROZEN") || kind.includes("UPDATED")) return "isAdmin";
  return "isDefault";
}

function getKindIcon(kind: string): { icon: JSX.Element; label: string } {
  switch (kind) {
    case "FOLLOWED":
      return { icon: <IconRepeat size={14} filled />, label: "Followed" };
    case "UNFOLLOWED":
      return { icon: <IconRepeat size={14} filled />, label: "Unfollowed" };
    case "POST_LIKED":
    case "COMMENT_LIKED":
      return { icon: <IconHeart size={14} filled />, label: "Liked" };
    case "POST_UNLIKED":
    case "COMMENT_UNLIKED":
      return { icon: <IconHeart size={14} filled />, label: "Unliked" };
    case "POST_SAVED":
    case "COMMENT_SAVED":
      return { icon: <IconBookmark size={14} filled />, label: "Saved" };
    case "POST_UNSAVED":
    case "COMMENT_UNSAVED":
      return { icon: <IconBookmark size={14} filled />, label: "Unsaved" };
    case "POST_COMMENTED":
    case "COMMENT_REPLIED":
    case "COMMENT_REMOVED":
      return { icon: <IconMessage size={14} filled />, label: "Comment" };
    case "POST_TIPPED":
    case "COMMENT_TIPPED":
      return { icon: <IconCoin size={14} filled />, label: "Tipped" };
    case "PROTOCOL_SUPPORTED":
      return { icon: <IconCoin size={14} filled />, label: "Treasury" };
    case "WITHDRAW_FEE_PAID":
      return { icon: <IconCoin size={14} filled />, label: "Fee" };
    case "POST_UPDATED_BY_ADMIN":
      return { icon: <IconEdit size={14} filled />, label: "Updated by admin" };
    case "POST_FROZEN":
      return { icon: <IconEye size={14} filled />, label: "Post frozen" };
    case "POST_REMOVED_BY_ADMIN":
      return { icon: <IconTrash size={14} filled />, label: "Post removed" };
    case "POST_REPORTED":
    case "COMMENT_REPORTED":
      return { icon: <IconFlag size={14} filled />, label: "Reported" };
    case "POSTER_APPROVAL_REQUESTED":
      return { icon: <IconQuestion size={14} filled />, label: "Approval requested" };
    case "POSTER_APPROVED":
      return { icon: <IconCheck size={14} filled />, label: "Approved" };
    case "POSTER_DISAPPROVED":
      return { icon: <IconX size={14} filled />, label: "Disapproved" };
    case "PROFILE_MODERATED":
    case "PROFILE_CLEARED_BY_ADMIN":
      return { icon: <IconEdit size={14} filled />, label: "Profile action" };
    default:
      return { icon: <IconMessage size={14} filled />, label: "Notification" };
  }
}

export function NotificationsList({ items, lastSeenTs, onSelect, chainId }: Props) {
  const feedState = useFeedState();
  const feedActions = useFeedActions();

  const nativeSymbol = useMemo(() => getNativeSymbol(chainId), [chainId]);

  const tokenIdsForThumbs = useMemo(() => {
    const ids = (items ?? [])
      .map((n) => String(n?.tokenId ?? "").trim())
      .filter((t) => Boolean(t) && t !== "0");
    return Array.from(new Set(ids));
  }, [items]);

  const tokenIdsKey = useMemo(() => tokenIdsForThumbs.join(","), [tokenIdsForThumbs]);

  useEffect(() => {
    if (!tokenIdsForThumbs.length) return;
    void feedActions.loadPostsByTokenIds(tokenIdsForThumbs);
  }, [feedActions, tokenIdsKey]);

  const postByKey = useMemo(() => {
    const map = new Map<string, Post>();
    for (const p of feedState.posts ?? []) {
      const tokenId = String(p?.tokenId ?? "").trim();
      if (!tokenId) continue;
      map.set(postKeyFromParts(p.chainId, tokenId), p);
    }
    return map;
  }, [feedState.posts]);

  return (
    <div className="list">
      {items.map((n) => {
        const actorId = String(n.actor?.id ?? "");
        const isSelfPosterStatus = n.kind === "POSTER_APPROVED" || n.kind === "POSTER_DISAPPROVED";
        const displayName = isSelfPosterStatus
          ? "You"
          : String(n.actor?.name ?? "").trim() || (actorId ? shortAddress(actorId) : "Unknown");
        const avatarStyle = getAvatarStyle({
          avatarUrl: isSelfPosterStatus ? undefined : n.actor?.avatar ?? undefined,
          hue: stableHueFromSeed(isSelfPosterStatus ? "" : actorId)
        });

        const commentId = typeof n.commentId === "string" && n.commentId.trim() ? n.commentId.trim() : "";
        const hash = commentId ? `#comment-${commentId}` : "";
        const isRemovedPost = n.kind === "POST_REMOVED_BY_ADMIN";
        const isAccountLevel = String(n.tokenId) === "0";
        const isUnread = typeof n.timestamp === "number" ? n.timestamp > lastSeenTs : false;
        const kindClass = getKindClass(n.kind);
        const kindIcon = getKindIcon(n.kind);
        const actionText = isSelfPosterStatus
          ? n.kind === "POSTER_DISAPPROVED"
            ? "were disapproved to post"
            : "were approved to post"
          : (() => {
              const base = notificationActionText(n.kind);
              const isTip = isAmountKind(n.kind);
              const amountWei = typeof n.amountWei === "bigint" ? n.amountWei : null;
              if (!isTip || !amountWei) return base;

              const bps = typeof n.supportBps === "number" ? n.supportBps : 0;
              const showPct = bps > 0 && (n.kind === "PROTOCOL_SUPPORTED" || n.kind === "WITHDRAW_FEE_PAID");
              const pctText = showPct ? ` • ${formatBps(bps)}` : "";
              return `${base} (${formatAmountWei(amountWei, nativeSymbol)}${pctText})`;
            })();

        const showThumb = String(n.tokenId ?? "").trim() && String(n.tokenId) !== "0";
        const postChainId = typeof n.chainId === "string" && n.chainId.trim() ? n.chainId.trim() : null;
        const profileLink = !isSelfPosterStatus && actorId ? getProfileUrl(postChainId, actorId) : "";
        const to = isAccountLevel ? profileLink : `/post/${n.tokenId}${hash}`;
        const post = showThumb
          ? postByKey.get(postKeyFromParts(postChainId, String(n.tokenId))) ??
            postByKey.get(postKeyFromParts(null, String(n.tokenId))) ??
            null
          : null;
        const postImage = typeof post?.image === "string" ? post.image.trim() : "";
        const postThumbUrl = postImage ? ipfsToHttp(postImage) : "";

        return (
          <button
            key={n.id}
            type="button"
            className={`listRow notificationRow ${isUnread ? "isUnread" : ""}`}
            style={{
              width: "100%",
              textAlign: "left",
              cursor: isRemovedPost || (!to && isAccountLevel) ? "default" : "pointer"
            }}
            onClick={() => {
              if (isRemovedPost) return;
              if (!to && isAccountLevel) return;
              onSelect(n, to);
            }}
            aria-disabled={isRemovedPost || (!to && isAccountLevel) ? true : undefined}
          >
            <div className="listRowLeft">
              <div className="notificationAvatarWrap" aria-hidden="true">
                <div className="avatar" style={avatarStyle} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="profileName" title={displayName}>
                  {profileLink ? (
                    <Link
                      className="notificationActorLink"
                      to={profileLink}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {displayName}
                    </Link>
                  ) : (
                    displayName
                  )}{" "}
                  {actionText}
                </div>
              </div>
            </div>
            {showThumb ? (
              <div className="listRowRight" aria-hidden="true">
                <div
                  className={`notificationPostThumb ${postThumbUrl ? "" : "isPlaceholder"}`}
                  style={postThumbUrl ? { backgroundImage: `url(${postThumbUrl})` } : undefined}
                />
                <span className={`notificationActionIcon ${kindClass}`} title={kindIcon.label}>
                  {kindIcon.icon}
                </span>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
