
export function notificationActionText(kind: string): string {
  switch (kind) {
    case "FOLLOWED":
      return "followed you";
    case "UNFOLLOWED":
      return "unfollowed you";
    case "POST_LIKED":
      return "liked your post";
    case "POST_UNLIKED":
      return "unliked your post";
    case "POST_SAVED":
      return "saved your post";
    case "POST_UNSAVED":
      return "unsaved your post";
    case "POST_COMMENTED":
      return "commented on your post";
    case "POST_TIPPED":
      return "tipped your post";
    case "POST_UPDATED_BY_ADMIN":
      return "updated your post";
    case "POST_FROZEN":
      return "froze your post";
    case "POST_REPORTED":
      return "reported a post";
    case "COMMENT_LIKED":
      return "liked your comment";
    case "COMMENT_UNLIKED":
      return "unliked your comment";
    case "COMMENT_SAVED":
      return "saved your comment";
    case "COMMENT_UNSAVED":
      return "unsaved your comment";
    case "COMMENT_REPLIED":
      return "replied to your comment";
    case "COMMENT_TIPPED":
      return "tipped your comment";
    case "PROTOCOL_SUPPORTED":
      return "supported the protocol";
    case "WITHDRAW_FEE_PAID":
      return "paid a withdrawal fee";
    case "COMMENT_REPORTED":
      return "reported a comment";
    case "POSTER_APPROVAL_REQUESTED":
      return "requested posting approval";
    case "POSTER_APPROVED":
      return "was approved to post";
    case "POSTER_DISAPPROVED":
      return "was disapproved to post";
    case "PROFILE_MODERATED":
      return "moderated your profile";
    case "PROFILE_CLEARED_BY_ADMIN":
      return "cleared your profile";
    case "POST_REMOVED_BY_ADMIN":
      return "removed your post";
    case "COMMENT_REMOVED":
      return "removed your comment";
    default:
      return "interacted with you";
  }
}
