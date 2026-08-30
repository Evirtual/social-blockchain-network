/**
 * The result of attempting a tip.
 *
 * The reason for a rejection travels with the result rather than through the
 * shared status. Status is rendered only in the sidebar, which the feed does not
 * show and narrow viewports drop, and reading it back after the attempt races
 * the re-render that publishes it.
 */
export type TipOutcome = {
  ok: boolean;
  /** Present when `ok` is false and there is something worth telling the user. */
  error?: string;
};

export const tipSucceeded: TipOutcome = { ok: true };

export function tipRejected(error: string): TipOutcome {
  return { ok: false, error };
}
