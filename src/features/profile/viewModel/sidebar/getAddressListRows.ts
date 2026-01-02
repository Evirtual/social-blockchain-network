import { ipfsToHttp } from "@features/ipfs";
import { stableHueFromSeed } from "@shared/lib/formatters";

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
    const avatarStyle = avatarUrl
      ? { backgroundImage: `url(${ipfsToHttp(avatarUrl)})` }
      : { background: `hsl(${stableHueFromSeed(addr)} 75% 55%)` };
    return {
      addr,
      label: args.shortAddress(addr),
      avatarStyle
    };
  });
}
