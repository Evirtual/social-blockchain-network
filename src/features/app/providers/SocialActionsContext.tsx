import { createContext, useContext, useMemo } from "react";
import type { Draft, Post } from "@types";
import { hasPinata } from "../../ipfs";
import { useBestEffortUnpinCidsSafe, useEditPostFlow, useEnsureMatchingNetwork, usePostActions } from "../../social";
import { useContract } from "./ContractContext";
import { useFeed } from "./FeedContext";
import { useStatus } from "./StatusContext";
import { useTxNotifications } from "./TxNotificationsContext";
import { useWallet } from "./WalletContext";
import { useContractTx } from "./useContractTx";

export type SocialActionsContextValue = {
  isOwner: boolean;

  // Per-post UI state + actions
  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;

  setEditDraft: React.Dispatch<React.SetStateAction<Draft>>;

  onEditSelectFile: (file: File | null) => Promise<void>;
  onEditClearImage: () => void;

  startEditPost: (post: Post) => void;
  cancelEditPost: () => void;
  saveEditedPost: () => Promise<void>;

  burnPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
  freezePost: (tokenId: string, postChainId?: string | null) => Promise<void>;

  handleAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  handleTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;

  withdrawTips: () => Promise<void>;
};

const SocialActionsContext = createContext<SocialActionsContextValue | null>(null);

export function SocialActionsProvider({ children }: { children: React.ReactNode }) {
  const { walletAddress, chainId, refreshWalletPanel } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();
  const feed = useFeed();
  const txNotifications = useTxNotifications();
  const { runContractTx } = useContractTx();

  const getReadContract = contract.getReadContract;
  const getWriteContract = contract.getWriteContract;

  const ipfsConfigured = useMemo(() => hasPinata(), []);
  const isOwner = contract.isOwner;

  const ensureMatchingNetwork = useEnsureMatchingNetwork(chainId, setStatus);
  const bestEffortUnpinCidsSafe = useBestEffortUnpinCidsSafe({ ipfsConfigured, posts: feed.posts });

  const edit = useEditPostFlow({
    walletAddress,
    chainId,
    isOwner,
    ipfsConfigured,
    getReadContract,
    getWriteContract,
    runContractTx,
    feed,
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
    feed,
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

export function useSocialActions() {
  const ctx = useContext(SocialActionsContext);
  if (!ctx) throw new Error("useSocialActions must be used within <SocialActionsProvider>");
  return ctx;
}
