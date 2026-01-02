import { useMemo } from "react";
import { useTipWithRefresh, useSocialActions } from "@features/social";
import type { PostActionsController } from "../types";

export function usePostActionsController(): PostActionsController {
  const social = useSocialActions();
  const onTip = useTipWithRefresh();

  return useMemo(
    () => ({
      editingTokenId: social.editingTokenId,
      editDraft: social.editDraft,
      isEditImageLoading: social.isEditImageLoading,
      onSetEditDraft: social.setEditDraft,
      onStartEditPost: social.startEditPost,
      onCancelEditPost: social.cancelEditPost,
      onSaveEditedPost: social.saveEditedPost,
      onEditSelectFile: social.onEditSelectFile,
      onEditClearImage: social.onEditClearImage,
      onAction: social.handleAction,
      onTip,
      replyToComment: social.replyToComment,
      editComment: social.editComment,
      deleteComment: social.deleteComment,
      toggleCommentLike: social.toggleCommentLike,
      toggleCommentSave: social.toggleCommentSave,
      tipComment: social.tipComment,
      reportPost: social.reportPost,
      reportComment: social.reportComment,
      onBurn: social.burnPost,
      onFreezePost: social.freezePost
    }),
    [social, onTip]
  );
}
