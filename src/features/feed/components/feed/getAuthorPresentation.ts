export function getAuthorPresentation(params: {
  author: string | undefined | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  shortAddress: (address: string) => string;
  guestHue: number;
}): {
  authorLabel: string;
  authorHue: number;
  authorAvatarUrl: string | undefined;
} {
  const { author, authorIdentity, shortAddress, guestHue } = params;

  const authorKey = author?.toLowerCase();
  const info = authorKey ? authorIdentity.get(authorKey) : undefined;
  const authorLabel = (info?.name?.trim() || (author ? shortAddress(author) : "Unknown")) as string;

  return {
    authorLabel,
    authorHue: info?.hue ?? guestHue,
    authorAvatarUrl: info?.avatarUrl
  };
}
