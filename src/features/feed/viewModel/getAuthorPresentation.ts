import { normalizeAddress } from "@shared/lib/address";
import { profileKey } from "@features/profile";
import { shortAddress } from "@shared/lib/format";

export function getAuthorPresentation(params: {
  author: string | undefined | null;
  chainId?: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  guestHue: number;
}): {
  authorLabel: string;
  authorHue: number;
  authorAvatarUrl: string | undefined;
} {
  const { author, chainId, authorIdentity, guestHue } = params;

  // Identities are per chain: the same address can be "BSC Origin" on one
  // network and "Base Origin" on another.
  const authorKey = normalizeAddress(author);
  const info = authorKey ? authorIdentity.get(profileKey(chainId, authorKey)) : undefined;
  const authorLabel = (info?.name?.trim() || (author ? shortAddress(author) : "Unknown")) as string;

  return {
    authorLabel,
    authorHue: info?.hue ?? guestHue,
    authorAvatarUrl: info?.avatarUrl
  };
}
