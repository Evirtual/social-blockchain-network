import type { PostComment } from "@types";
import { querySubgraph, type SubgraphVariables } from "@shared/lib/subgraphQuery";
import { isLikelySubgraphSchemaMismatch } from "@shared/lib/subgraphSchemaMismatch";

function toInt(v: string | number | bigint | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toBigInt(v: string | number | bigint | null | undefined): bigint {
  try {
    return BigInt(String(v ?? "0"));
  } catch {
    return 0n;
  }
}

type SubgraphCommentRow = {
  commentId: string;
  tokenId: string;
  author?: { id?: string } | string;
  parentId?: string | null;
  comment?: string;
  deleted?: boolean;
  edited?: boolean;
  likeCount?: string;
  saveCount?: string;
  tipWei?: string;
  createdTxHash?: string;
  createdAtBlock?: string;
};

export async function loadCommentsFromSubgraph(args: {
  url: string;
  tokenId: string;
  first?: number;
  account?: string | null;
}): Promise<PostComment[]> {
  const first = Math.max(1, Math.min(1000, Number(args.first ?? 500)));
  const tokenId = String(args.tokenId);
  const accountLower = typeof args.account === "string" ? args.account.trim().toLowerCase() : "";

  const commentsQuery = `
    query PostComments($first: Int!, $tokenId: String!) {
      comments(
        first: $first,
        orderBy: createdAtBlock,
        orderDirection: asc,
        where: { tokenId: $tokenId }
      ) {
        commentId
        tokenId
        author { id }
        parentId
        comment
        deleted
        edited
        likeCount
        saveCount
        tipWei
        createdTxHash
        createdAtBlock
      }
    }
  `;

  let data: { comments: SubgraphCommentRow[] };
  try {
    data = await querySubgraph<{ comments: SubgraphCommentRow[] }>({
      url: args.url,
      query: commentsQuery,
      variables: { first, tokenId } satisfies SubgraphVariables,
      timeoutMs: 12_000
    });
  } catch (err) {
    if (isLikelySubgraphSchemaMismatch(err)) {
      // If the deployment doesn't include comment indexing yet, treat as empty.
      return [];
    }
    throw err;
  }

  const rows = Array.isArray(data?.comments) ? data.comments : [];
  const base = rows.map((c) => {
    const author = typeof c.author === "string" ? c.author : String(c.author?.id ?? "");
    return {
      commentId: String(c.commentId ?? ""),
      tokenId: String(c.tokenId ?? tokenId),
      author,
      parentId: c.parentId ?? null,
      comment: String(c.comment ?? ""),
      deleted: Boolean(c.deleted),
      edited: Boolean(c.edited),
      likeCount: toInt(c.likeCount),
      saveCount: toInt(c.saveCount),
      tipWei: toBigInt(c.tipWei),
      txHash: typeof c.createdTxHash === "string" ? c.createdTxHash : undefined,
      blockNumber: toInt(c.createdAtBlock)
    } satisfies PostComment;
  });

  if (!accountLower || base.length === 0) return base;

  // Best-effort: liked/saved-by-me from edges. If it fails, keep comments usable.
  const commentIds = base.map((c) => c.commentId).filter(Boolean).slice(0, 1000);
  if (commentIds.length === 0) return base;

  const edgesQuery = `
    query CommentEdges($account: ID!, $commentIds: [String!]!) {
      commentLikeEdges(first: 1000, where: { account: $account, active: true, commentId_in: $commentIds }) {
        commentId
      }
      commentSaveEdges(first: 1000, where: { account: $account, active: true, commentId_in: $commentIds }) {
        commentId
      }
    }
  `;

  try {
    const edges = await querySubgraph<{
      commentLikeEdges: Array<{ commentId: string }>;
      commentSaveEdges: Array<{ commentId: string }>;
    }>({
      url: args.url,
      query: edgesQuery,
      variables: { account: accountLower, commentIds } satisfies SubgraphVariables,
      timeoutMs: 8_000
    });

    const likedSet = new Set((edges.commentLikeEdges ?? []).map((e) => String(e.commentId)));
    const savedSet = new Set((edges.commentSaveEdges ?? []).map((e) => String(e.commentId)));

    return base.map((c) => ({
      ...c,
      likedByMe: likedSet.has(c.commentId),
      savedByMe: savedSet.has(c.commentId)
    }));
  } catch {
    return base;
  }
}
