import { AddressListModal } from "./AddressListModal";

export type FollowersModalProps = {
  open: boolean;
  followers: string[];
  isLoadingFollowers?: boolean;
  onClose: () => void;
  headerLeading?: React.ReactNode;
};

export function FollowersModal(props: FollowersModalProps) {
  return (
    <AddressListModal
      open={props.open}
      title="Followers"
      addresses={props.followers}
      isLoading={props.isLoadingFollowers}
      emptyText="No followers yet."
      onClose={props.onClose}
      headerLeading={props.headerLeading}
    />
  );
}
