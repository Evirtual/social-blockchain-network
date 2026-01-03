import { IconEdit, IconPower } from "@shared/components/icons";

type Props = {
  walletAddress: string | null;
  isEditingProfile: boolean;
  isOwner: boolean;
  isLoadingOwner: boolean;
  isLoadingOnChainRequests: boolean;
  approvalsCount: number;
  onStartEditProfile: () => void;
  onOpenApprovals: () => void;
  onDisconnectWallet: () => void;
};

export function ProfileSidebarActions(props: Props) {
  return (
    <>
      {!props.isEditingProfile ? (
        <button className="cardActionLink" type="button" onClick={props.onStartEditProfile}>
          <IconEdit size={16} />
          Edit
        </button>
      ) : null}
      {props.walletAddress && !props.isEditingProfile && props.isOwner ? (
        <span className="cardHeaderStatSep" aria-hidden="true">|</span>
      ) : null}
      {props.walletAddress && !props.isEditingProfile && props.isOwner ? (
        <button
          className="cardHeaderStatLink buttonWithSpinner cardActionApprove"
          type="button"
          onClick={props.onOpenApprovals}
          aria-label="Approvals"
        >
          {props.isLoadingOnChainRequests ? (
            <>
              <span className="skeletonLine" style={{ width: "2.1rem", height: "0.85rem" }} aria-hidden="true" /> approve
            </>
          ) : (
            `${props.approvalsCount} approve`
          )}
        </button>
      ) : null}
      {props.walletAddress && !props.isEditingProfile ? (
        <button
          className="ghost iconButton profileDisconnectButton"
          type="button"
          onClick={props.onDisconnectWallet}
          aria-label="Disconnect"
          title="Disconnect"
        >
          <IconPower size={20} strokeWidth={2.2} />
        </button>
      ) : null}
    </>
  );
}
