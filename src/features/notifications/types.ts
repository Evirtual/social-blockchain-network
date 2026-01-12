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
  timestamp: number;
  actor: NotificationActor;
};
