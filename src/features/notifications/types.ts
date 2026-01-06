export type NotificationKind =
  | "POST_LIKED"
  | "POST_SAVED"
  | "POST_COMMENTED"
  | "COMMENT_LIKED"
  | "COMMENT_SAVED"
  | "COMMENT_REPLIED";

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
