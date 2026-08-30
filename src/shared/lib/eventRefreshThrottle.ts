/**
 * Bounds how often chain events may trigger a refetch.
 *
 * Contract events arrive for the whole network, not just the current user, so
 * activity from strangers used to drive one subgraph request per event. The
 * recipient of a like or save cannot be worked out in the browser — the
 * subgraph resolves it by loading the post — so the volume is capped here
 * instead of filtered precisely.
 *
 * The first event in a quiet period refreshes immediately; further events
 * inside the window collapse into a single trailing refresh.
 */
export type EventRefreshThrottle = {
  /** Request a refresh. Returns true when one was run immediately. */
  request: () => boolean;
  cancel: () => void;
};

export function createEventRefreshThrottle(args: {
  onRefresh: () => void;
  intervalMs: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}): EventRefreshThrottle {
  const now = args.now ?? (() => Date.now());
  const setTimer = args.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms) as unknown as number);
  const clearTimer = args.clearTimer ?? ((id) => window.clearTimeout(id));
  const intervalMs = Math.max(0, args.intervalMs);

  let lastRunAt = Number.NEGATIVE_INFINITY;
  let timerId: number | null = null;

  const run = () => {
    lastRunAt = now();
    args.onRefresh();
  };

  return {
    request() {
      // A trailing refresh is already queued; this event folds into it.
      if (timerId != null) return false;

      const elapsed = now() - lastRunAt;
      if (elapsed >= intervalMs) {
        run();
        return true;
      }

      timerId = setTimer(() => {
        timerId = null;
        run();
      }, intervalMs - elapsed);
      return false;
    },

    cancel() {
      if (timerId == null) return;
      clearTimer(timerId);
      timerId = null;
    }
  };
}

type AddressBearingEvent = { args?: unknown[] };

/**
 * True when the current user is the only address in the event.
 *
 * The subgraph never notifies an actor about their own action, so such an
 * event cannot produce anything to fetch.
 */
export function isSelfOnlyEvent(event: AddressBearingEvent, walletAddress: string | null): boolean {
  const self = (walletAddress ?? "").trim().toLowerCase();
  if (!self) return false;

  const addresses = (Array.isArray(event?.args) ? event.args : [])
    .map((a) => (typeof a === "string" ? a.trim().toLowerCase() : ""))
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a));

  if (addresses.length === 0) return false;
  return addresses.every((a) => a === self);
}
