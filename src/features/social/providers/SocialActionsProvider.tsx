import { useMemo } from "react";
import { hasPinata } from "@features/ipfs";
import { useBestEffortUnpinCidsSafe } from "../hooks/useBestEffortUnpinCidsSafe";
import { useCommentActions } from "../hooks/useCommentActions";
import { useEditPostFlow } from "../hooks/useEditPostFlow";
import { useEnsureMatchingNetwork } from "../hooks/useEnsureMatchingNetwork";
import { usePostEngagement } from "../hooks/usePostEngagement";
import { usePostModeration } from "../hooks/usePostModeration";
import { usePostTips } from "../hooks/usePostTips";
import { useContractActionsFacade, useContractState } from "@features/contract";
import { useFeedActions, useFeedState } from "@features/feed";
import { useStatusActions } from "@features/status";
import { useTxNotifications } from "@features/tx";
import { useWalletActions, useWalletState } from "@features/wallet";
import { SocialActionsContext, type SocialActionsContextValue } from "./socialActionsStateContext";

export function SocialActionsProvider({ children }: { children: React.ReactNode }) {
  const { walletAddress, chainId } = useWalletState();
  const { refreshWalletPanel } = useWalletActions();
  const { setStatus } = useStatusActions();
  const contractState = useContractState();
  const contractActions = useContractActionsFacade();
  const feedState = useFeedState();
  const feedActions = useFeedActions();
  const txNotifications = useTxNotifications();
  const { runContractTx } = contractActions;

  const getReadContract = contractActions.getReadContract;
  const getWriteContract = contractActions.getWriteContract;

  const ipfsConfigured = hasPinata();
  const isOwner = contractState.isOwner;

  const ensureMatchingNetwork = useEnsureMatchingNetwork(chainId, setStatus);
  const bestEffortUnpinCidsSafe = useBestEffortUnpinCidsSafe({ ipfsConfigured, posts: feedState.posts });

  const edit = useEditPostFlow({
    walletAddress,
    chainId,
    isOwner,
    ipfsConfigured,
    getReadContract,
    getWriteContract,
    runContractTx,
    feed: { posts: feedState.posts, setPosts: feedActions.setPosts, refreshFeed: feedActions.refreshFeed },
    setStatus,
    txNotifications,
    bestEffortUnpinCidsSafe
  });

  const moderation = usePostModeration({
    walletAddress,
    chainId,
    isOwner,
    ipfsConfigured,
    getReadContract,
    getWriteContract,
    runContractTx,
    feed: {
      posts: feedState.posts,
      setPosts: feedActions.setPosts,
      refreshFeed: feedActions.refreshFeed,
      setPostComments: feedActions.setPostComments
    },
    setStatus,
    ensureMatchingNetwork,
    bestEffortUnpinCidsSafe,
    editingTokenId: edit.editingTokenId,
    cancelEditPost: edit.cancelEditPost
  });

  const engagement = usePostEngagement({
    walletAddress,
    chainId,
    getWriteContract,
    runContractTx,
    feed: {
      posts: feedState.posts,
      setPosts: feedActions.setPosts,
      loadCommentsForPost: feedActions.loadCommentsForPost
    },
    setStatus,
    ensureMatchingNetwork
  });

  const commentActions = useCommentActions({
    walletAddress,
    chainId,
    refreshWalletPanel,
    getWriteContract,
    runContractTx,
    feed: {
      posts: feedState.posts,
      setPosts: feedActions.setPosts,
      setPostComments: feedActions.setPostComments,
      loadCommentsForPost: feedActions.loadCommentsForPost
    },
    setStatus,
    ensureMatchingNetwork
  });

  const tips = usePostTips({
    walletAddress,
    refreshWalletPanel,
    getWriteContract,
    runContractTx,
    feed: {
      setPosts: feedActions.setPosts
    },
    setStatus,
    ensureMatchingNetwork
  });

  const value = useMemo<SocialActionsContextValue>(
    () => ({
      isOwner,
      editingTokenId: edit.editingTokenId,
      editDraft: edit.editDraft,
      isEditImageLoading: edit.isEditImageLoading,
      setEditDraft: edit.setEditDraft,
      onEditSelectFile: edit.onEditSelectFile,
      onEditClearImage: edit.onEditClearImage,
      startEditPost: edit.startEditPost,
      cancelEditPost: edit.cancelEditPost,
      saveEditedPost: edit.saveEditedPost,
      burnPost: moderation.burnPost,
      freezePost: moderation.freezePost,
      handleAction: engagement.handleAction,
      handleTip: tips.handleTip,
      replyToComment: commentActions.replyToComment,
      editComment: commentActions.editComment,
      deleteComment: commentActions.deleteComment,
      toggleCommentLike: commentActions.toggleLike,
      toggleCommentSave: commentActions.toggleSave,
      tipComment: commentActions.tipComment,
      reportPost: commentActions.reportPost,
      reportComment: commentActions.reportComment,
      withdrawTips: tips.withdrawTips
    }),
    [
      isOwner,
      edit.editingTokenId,
      edit.editDraft,
      edit.isEditImageLoading,
      edit.setEditDraft,
      edit.onEditSelectFile,
      edit.onEditClearImage,
      edit.startEditPost,
      edit.cancelEditPost,
      edit.saveEditedPost,
      moderation.burnPost,
      moderation.freezePost,
      engagement.handleAction,
      tips.handleTip,
      commentActions.replyToComment,
      commentActions.editComment,
      commentActions.deleteComment,
      commentActions.toggleLike,
      commentActions.toggleSave,
      commentActions.tipComment,
      commentActions.reportPost,
      commentActions.reportComment,
      tips.withdrawTips
    ]
  );

  return <SocialActionsContext.Provider value={value}>{children}</SocialActionsContext.Provider>;
}
