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
      onBurn: social.burnPost,
      onFreezePost: social.freezePost
    }),
    [social, onTip]
  );
}
