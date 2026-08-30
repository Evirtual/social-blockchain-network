/** A profile as held in state. Lives beside the parser rather than on the hook,
 * so the parser can name its own return type without importing the hook. */
export type ProfileRecord = { name: string; bio: string; avatarUrl: string };
