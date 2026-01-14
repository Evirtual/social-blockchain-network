export type NotificationKind =
  | "FOLLOWED"
  | "UNFOLLOWED"
  | "POST_LIKED"
  | "POST_UNLIKED"
  | "POST_SAVED"
  | "POST_UNSAVED"
  | "POST_COMMENTED"
  | "POST_TIPPED"
  | "POST_UPDATED_BY_ADMIN"
  | "POST_FROZEN"
  | "POST_REPORTED"
  | "COMMENT_LIKED"
  | "COMMENT_UNLIKED"
  | "COMMENT_SAVED"
  | "COMMENT_UNSAVED"
  | "COMMENT_REPLIED"
  | "COMMENT_TIPPED"
  | "COMMENT_REPORTED"
  | "POSTER_APPROVAL_REQUESTED"
  | "POSTER_APPROVED"
  | "POSTER_DISAPPROVED"
  | "PROFILE_MODERATED"
  | "PROFILE_CLEARED_BY_ADMIN"
  | "POST_REMOVED_BY_ADMIN"
  | "COMMENT_REMOVED";

// Newer versions of the subgraph can emit these.
// - PROTOCOL_SUPPORTED: a portion of a tip was routed to the protocol treasury
// - WITHDRAW_FEE_PAID: a withdrawal fee was routed to the protocol treasury
// Kept out of the union above to avoid breaking older cached items that may have unknown kinds.
export type ProtocolNotificationKind = "PROTOCOL_SUPPORTED" | "WITHDRAW_FEE_PAID";

export type NotificationActor = {
  id: string;
  name?: string | null;
  avatar?: string | null;
};

export type NotificationItem = {
  id: string;
  kind: string;
  tokenId: string;
  chainId?: string | null;
  commentId?: string | null;
  amountWei?: bigint | null;
  supportBps?: number | null;
  timestamp: number;
  actor: NotificationActor;
};
