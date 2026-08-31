import type { CSSProperties } from "react";
import { Modal } from "@shared/components/Modal";
import { CommentsCard } from "../../CommentsCard";
import type { PostComment } from "@types";
import type { PostActionsController } from "@features/post/types";

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

  postActions: PostActionsController;
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
        postActions={props.postActions}
      />
    </Modal>
  );
}
