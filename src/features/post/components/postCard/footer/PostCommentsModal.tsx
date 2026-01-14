import type { CSSProperties } from "react";
import { Modal } from "@shared/components/Modal";
import { CommentsCard } from "../../CommentsCard";
import type { PostComment } from "@types";

type Props = {
  open: boolean;
  avatarStyle?: CSSProperties;
  onClose: () => void;
  tokenId: string;
  postChainId: string | null;
  chainId: string | null;
  walletAddress: string | null;
  allowCommenting: boolean;
  forceReadOnly?: boolean;
  disableAuthorProfileLookup?: boolean;
  canModerateComments?: boolean;
  comments: PostComment[];
  isLoadingComments: boolean;
  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onDeleteComment: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentLike: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentSave: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (
    tokenId: string,
    commentId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<boolean>;
  onReportPost: (tokenId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
  getNativeSymbol: (chainId: string | null) => string;
};

export function PostCommentsModal(props: Props) {
  return (
    <Modal
      open={props.open}
      title="Comments"
      headerLeading={<div className="avatar small" style={props.avatarStyle} />}
      onClose={props.onClose}
    >
      <CommentsCard
        tokenId={props.tokenId}
        postChainId={props.postChainId}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        useCardWrapper={false}
        allowCommenting={props.allowCommenting}
        forceReadOnly={props.forceReadOnly}
        disableAuthorProfileLookup={props.disableAuthorProfileLookup}
        canModerateComments={props.canModerateComments}
        comments={props.comments}
        isLoadingComments={props.isLoadingComments}
        onAction={props.onAction}
        onReply={props.onReply}
        onEditComment={props.onEditComment}
        onDeleteComment={props.onDeleteComment}
        onToggleCommentLike={props.onToggleCommentLike}
        onToggleCommentSave={props.onToggleCommentSave}
        onTipComment={props.onTipComment}
        onReportPost={props.onReportPost}
        onReportComment={props.onReportComment}
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getExplorerTxUrl={props.getExplorerTxUrl}
        getNativeSymbol={props.getNativeSymbol}
      />
    </Modal>
  );
}
