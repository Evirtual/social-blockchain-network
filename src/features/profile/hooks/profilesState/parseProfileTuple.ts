import type { ProfileRecord } from "../useProfilesState";

export function parseProfileTuple(
  tuple: | [string, string, string] | { name: string; bio: string; avatar: string } | null | undefined
): ProfileRecord {
  const name = Array.isArray(tuple) ? tuple[0] : (tuple?.name ?? "");
  const bio = Array.isArray(tuple) ? tuple[1] : (tuple?.bio ?? "");
  const avatar = Array.isArray(tuple) ? tuple[2] : (tuple?.avatar ?? "");
  return { name: name || "", bio: bio || "", avatarUrl: avatar || "" };
}
