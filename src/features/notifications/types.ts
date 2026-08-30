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
  message?: string | null;
  timestamp: number;
  actor: NotificationActor;
};
