import { useMemo } from "react";
import { hasPinata } from "@features/ipfs";
import { useBestEffortUnpinCidsSafe } from "../hooks/useBestEffortUnpinCidsSafe";
import { useEditPostFlow } from "../hooks/useEditPostFlow";
import { useEnsureMatchingNetwork } from "../hooks/useEnsureMatchingNetwork";
import { usePostActions } from "../hooks/usePostActions";
import { useContractActions, useContractState } from "@features/contract";
import { useFeedActions, useFeedState } from "@features/feed";
import { useStatusActions } from "@features/status";
import { useTxNotifications } from "@features/tx";
import { useWalletActions, useWalletState } from "@features/wallet";
import { useContractTx } from "@features/app/providers/useContractTx";
import { SocialActionsContext, type SocialActionsContextValue } from "./socialActionsStateContext";

export function SocialActionsProvider({ children }: { children: React.ReactNode }) {
  const { walletAddress, chainId } = useWalletState();
  const { refreshWalletPanel } = useWalletActions();
  const { setStatus } = useStatusActions();
  const contractState = useContractState();
  const contractActions = useContractActions();
  const feedState = useFeedState();
  const feedActions = useFeedActions();
  const txNotifications = useTxNotifications();
  const { runContractTx } = useContractTx();

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

  const actions = usePostActions({
    walletAddress,
    chainId,
    refreshWalletPanel,
    isOwner,
    ipfsConfigured,
    getReadContract,
    getWriteContract,
    runContractTx,
    feed: {
      posts: feedState.posts,
      setPosts: feedActions.setPosts,
      refreshFeed: feedActions.refreshFeed,
      loadCommentsForPost: feedActions.loadCommentsForPost,
      setPostComments: feedActions.setPostComments
    },
    setStatus,
    ensureMatchingNetwork,
    bestEffortUnpinCidsSafe,
    editingTokenId: edit.editingTokenId,
    cancelEditPost: edit.cancelEditPost
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
      burnPost: actions.burnPost,
      freezePost: actions.freezePost,
      handleAction: actions.handleAction,
      handleTip: actions.handleTip,
      withdrawTips: actions.withdrawTips
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
      actions.burnPost,
      actions.freezePost,
      actions.handleAction,
      actions.handleTip,
      actions.withdrawTips
    ]
  );

  return <SocialActionsContext.Provider value={value}>{children}</SocialActionsContext.Provider>;
}
