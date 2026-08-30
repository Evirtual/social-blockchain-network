import { AddressListModal } from "./AddressListModal";

export type FollowingModalProps = {
  open: boolean;
  following: string[];
  isLoadingFollowing?: boolean;
  onClose: () => void;
  headerLeading?: React.ReactNode;
};

export function FollowingModal(props: FollowingModalProps) {
  return (
    <AddressListModal
      open={props.open}
      title="Following"
      addresses={props.following}
      isLoading={props.isLoadingFollowing}
      emptyText="Not following anyone yet."
      onClose={props.onClose}
      headerLeading={props.headerLeading}
    />
  );
}
