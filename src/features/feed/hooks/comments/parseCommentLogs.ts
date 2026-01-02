import type { PostComment } from "@types";
import { socialInterface } from "@features/contract";

export function parseCommentLogs(logs: any[]): PostComment[] {
  const sorted = logs
    .slice()
    .sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0) || (a.logIndex ?? 0) - (b.logIndex ?? 0));
  const byId = new Map<string, PostComment>();

  for (const log of sorted) {
    const desc = socialInterface.parseLog(log);
    if (!desc) continue;

    const name = String((desc as any).name ?? "");
    const args = (desc as any).args as any;

    if (name === "CommentAdded") {
      const commentId = String(args.commentId ?? "");
      if (!commentId) continue;
      byId.set(commentId, {
        commentId,
        tokenId: String(args.tokenId ?? ""),
        author: String(args.commenter ?? ""),
        parentId: (args.parentId ?? 0n) === 0n ? null : String(args.parentId),
        comment: String(args.comment ?? ""),
        deleted: false,
        edited: false,
        likeCount: 0,
        saveCount: 0,
        tipWei: 0n,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex
      });
      continue;
    }

    if (
      name !== "CommentEdited" &&
      name !== "CommentDeleted" &&
      name !== "CommentLiked" &&
      name !== "CommentUnliked" &&
      name !== "CommentSaved" &&
      name !== "CommentUnsaved" &&
      name !== "CommentTipped"
    ) {
      continue;
    }

    const commentId = String(args.commentId ?? "");
    if (!commentId || !byId.has(commentId)) continue;

    const current = byId.get(commentId) as PostComment;
    if (name === "CommentEdited") {
      current.comment = String(args.comment ?? "");
      current.edited = true;
    } else if (name === "CommentDeleted") {
      current.deleted = true;
      current.comment = "";
    } else if (name === "CommentLiked") {
      current.likeCount = (current.likeCount ?? 0) + 1;
    } else if (name === "CommentUnliked") {
      const next = (current.likeCount ?? 0) - 1;
      current.likeCount = next < 0 ? 0 : next;
    } else if (name === "CommentSaved") {
      current.saveCount = (current.saveCount ?? 0) + 1;
    } else if (name === "CommentUnsaved") {
      const next = (current.saveCount ?? 0) - 1;
      current.saveCount = next < 0 ? 0 : next;
    } else if (name === "CommentTipped") {
      const amount = typeof args.amountWei === "bigint" ? args.amountWei : BigInt(String(args.amountWei ?? "0"));
      current.tipWei = (current.tipWei ?? 0n) + amount;
    }

    byId.set(commentId, current);
  }

  const list = Array.from(byId.values());
  return list.sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0) || (a.logIndex ?? 0) - (b.logIndex ?? 0));
}
