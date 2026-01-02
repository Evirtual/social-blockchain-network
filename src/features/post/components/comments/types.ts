export type ActiveComposer = {
  type: "reply" | "edit" | "tip" | "report" | "post-report" | null;
  commentId?: string;
};

export type ActionInFlight = {
  id: string | null;
  action: string | null;
};
