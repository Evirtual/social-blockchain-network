import type { ProfileCardProps, WalletCardProps } from "@features/app";
import { ProfileCard, WalletCard } from "@features/app";

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
