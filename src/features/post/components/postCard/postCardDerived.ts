import { ipfsToHttp } from "@features/ipfs";

export function getAvatarStyle(params: { authorAvatarUrl?: string; authorHue: number }) {
  const { authorAvatarUrl, authorHue } = params;
  return authorAvatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(authorAvatarUrl)})` }
    : { background: `hsl(${authorHue} 75% 55%)` };
}
