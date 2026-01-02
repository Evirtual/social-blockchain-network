import { stableHueFromSeed } from "@shared/lib/formatters";
import { getAvatarStyle } from "@shared/lib/avatar";

export type AddressListRow = {
  addr: string;
  label: string;
  avatarStyle: { backgroundImage?: string; background?: string };
};

export function getAddressListRows(args: {
  addresses: string[];
  profilesByAddress: Record<string, { avatarUrl: string } | undefined>;
  shortAddress: (address: string) => string;
}): AddressListRow[] {
  return args.addresses.map((addr) => {
    const key = addr.toLowerCase();
    const profile = args.profilesByAddress[key];
    const avatarUrl = profile?.avatarUrl?.trim();
    const avatarStyle = getAvatarStyle({ avatarUrl, hue: stableHueFromSeed(addr) });
    return {
      addr,
      label: args.shortAddress(addr),
      avatarStyle
    };
  });
}
