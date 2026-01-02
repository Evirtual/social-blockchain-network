import { ipfsToHttp } from "@features/ipfs";

export function getAvatarStyle(params: { avatarUrl?: string; hue: number }) {
  const url = params.avatarUrl?.trim();
  return url ? { backgroundImage: `url(${ipfsToHttp(url)})` } : { background: `hsl(${params.hue} 75% 55%)` };
}
