export type NotificationKind =
  | "POST_LIKED"
  | "POST_SAVED"
  | "POST_COMMENTED"
  | "POST_TIPPED"
  | "COMMENT_LIKED"
  | "COMMENT_SAVED"
  | "COMMENT_REPLIED"
  | "COMMENT_TIPPED"
  | "POSTER_APPROVAL_REQUESTED"
  | "POSTER_APPROVED"
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
  timestamp: number;
  actor: NotificationActor;
};
