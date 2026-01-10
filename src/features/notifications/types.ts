export type NotificationKind =
  | "FOLLOWED"
  | "POST_LIKED"
  | "POST_SAVED"
  | "POST_COMMENTED"
  | "POST_TIPPED"
  | "POST_UPDATED_BY_ADMIN"
  | "POST_FROZEN"
  | "COMMENT_LIKED"
  | "COMMENT_SAVED"
  | "COMMENT_REPLIED"
  | "COMMENT_TIPPED"
  | "POSTER_APPROVAL_REQUESTED"
  | "POSTER_APPROVED"
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
  timestamp: number;
  actor: NotificationActor;
};
