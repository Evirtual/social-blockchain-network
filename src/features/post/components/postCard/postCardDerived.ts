import { getAvatarStyle as getBaseAvatarStyle } from "@shared/lib/avatar";

export function getAvatarStyle(params: { authorAvatarUrl?: string; authorHue: number }) {
  return getBaseAvatarStyle({ avatarUrl: params.authorAvatarUrl, hue: params.authorHue });
}
