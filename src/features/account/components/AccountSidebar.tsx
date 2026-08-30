import type { ProfileCardProps } from "../../app/components/sidebar/ProfileCard";
import type { WalletCardProps } from "../../app/components/sidebar/WalletCard";
import { ProfileCard } from "../../app/components/sidebar/ProfileCard";
import { WalletCard } from "../../app/components/sidebar/WalletCard";

type Props = ProfileCardProps & WalletCardProps;

export function AccountSidebar(props: Props) {
  const profileCardProps: ProfileCardProps = props;
  const walletCardProps: WalletCardProps = props;

  return (
    <>
      <ProfileCard {...profileCardProps} />
      <WalletCard {...walletCardProps} />
    </>
  );
}
