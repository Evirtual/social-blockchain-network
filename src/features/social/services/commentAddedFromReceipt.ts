import type { TransactionReceipt } from "ethers";
import type { Interface } from "ethers";

export type CommentAddedEvent = {
  commentId: string;
  parentId: string | null;
  tokenId: string;
  commenter: string;
  comment: string;
};

export function parseCommentAddedFromReceipt(args: {
  receipt: TransactionReceipt;
  contractInterface: Interface;
  contractAddress: string;
  expectedTokenId: bigint;
  expectedParentId?: bigint;
}): CommentAddedEvent | null {
  const contractAddress = String(args.contractAddress ?? "").toLowerCase();
  if (!contractAddress) return null;

  const logs = args.receipt?.logs ?? [];

  for (const log of logs) {
    try {
      if (String((log as any)?.address ?? "").toLowerCase() !== contractAddress) continue;
      const parsed = args.contractInterface.parseLog({ topics: (log as any).topics, data: (log as any).data });
      if (parsed?.name !== "CommentAdded") continue;

      const ev: any = parsed.args;
      const tokenIdBig = BigInt(ev?.tokenId ?? 0);
      if (tokenIdBig !== args.expectedTokenId) continue;

      const parentIdBig = BigInt(ev?.parentId ?? 0);
      if (typeof args.expectedParentId === "bigint" && parentIdBig !== args.expectedParentId) continue;

      const commentId = String(ev?.commentId ?? "");
      if (!commentId) return null;

      return {
        commentId,
        tokenId: tokenIdBig.toString(),
        parentId: parentIdBig === 0n ? null : parentIdBig.toString(),
        commenter: String(ev?.commenter ?? "").toLowerCase(),
        comment: String(ev?.comment ?? "")
      };
    } catch {
      // ignore and keep scanning
    }
  }

  return null;
}
