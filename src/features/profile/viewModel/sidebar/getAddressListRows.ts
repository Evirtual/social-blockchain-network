import { profileKey, type ProfileKey } from "../../lib/profileKey";
import { stableHueFromSeed } from "@shared/lib/formatters";
import { getAvatarStyle } from "@shared/lib/avatar";
import { shortAddress } from "@shared/lib/format";

export type AddressListRow = {
  addr: string;
  label: string;
  avatarStyle: { backgroundImage?: string; background?: string };
};

export function getAddressListRows(args: {
  addresses: string[];
  chainId: string | null;
  profilesByAddress: Record<ProfileKey, { avatarUrl: string } | undefined>;
}): AddressListRow[] {
  return args.addresses.map((addr) => {
    const key = profileKey(args.chainId, addr);
    const profile = args.profilesByAddress[key];
    const avatarUrl = profile?.avatarUrl?.trim();
    const avatarStyle = getAvatarStyle({ avatarUrl, hue: stableHueFromSeed(addr) });
    return {
      addr,
      label: shortAddress(addr),
      avatarStyle
    };
  });
}
