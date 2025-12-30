import type { PostComment } from "@types";
import { socialInterface } from "@features/contract";

export function parseCommentLogs(logs: any[]): PostComment[] {
  return logs.flatMap((log: any) => {
    const desc = socialInterface.parseLog(log);
    if (!desc) return [];
    return [
      {
        commenter: String(desc.args.commenter),
        comment: String(desc.args.comment),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex
      } satisfies PostComment
    ];
  });
}
