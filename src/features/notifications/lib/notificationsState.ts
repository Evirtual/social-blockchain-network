import type { NotificationItem } from "../types";

/**
 * One reducer for the notification list.
 *
 * Previously two effects wrote the same three pieces of state under different
 * rules: the initial load cleared the list on any error, while the background
 * refresh wrote only non-empty results and swallowed its failures. A refresh
 * that failed therefore blanked a list that had loaded perfectly well, and the
 * next success restored it - the panel appearing to flip between two states.
 *
 * The rules that prevent it:
 *
 * - An error is only ever shown when there is nothing else to show. Data already
 *   on screen survives a later failure.
 * - The loading state is likewise only entered with nothing to show, so a
 *   refresh never replaces a populated list with skeletons.
 * - A successful load always wins, including an empty result, which is a real
 *   answer rather than a failure.
 */
export type NotificationsState = {
  items: NotificationItem[];
  error: string;
  schemaMismatch: boolean;
  /** True once any load has succeeded, so failures know whether data exists. */
  hasLoaded: boolean;
  isLoading: boolean;
};

export type NotificationsAction =
  | { type: "reset" }
  | { type: "load-started" }
  | { type: "load-succeeded"; items: NotificationItem[]; schemaMismatch: boolean }
  | { type: "load-failed"; message: string }
  | { type: "refresh-succeeded"; items: NotificationItem[]; schemaMismatch: boolean }
  | { type: "refresh-failed" };

export const initialNotificationsState: NotificationsState = {
  items: [],
  error: "",
  schemaMismatch: false,
  hasLoaded: false,
  isLoading: false
};

export function notificationsReducer(
  state: NotificationsState,
  action: NotificationsAction
): NotificationsState {
  switch (action.type) {
    case "reset":
      return initialNotificationsState;

    case "load-started":
      return {
        ...state,
        error: "",
        // Showing skeletons over a list that is already on screen reads as the
        // data having been lost.
        isLoading: !state.hasLoaded
      };

    case "load-succeeded":
    case "refresh-succeeded":
      return {
        items: action.items,
        error: "",
        schemaMismatch: action.schemaMismatch,
        hasLoaded: true,
        isLoading: false
      };

    case "load-failed":
      // With data already on screen the failure is not worth reporting: the
      // list stays, and the next refresh will correct it.
      if (state.hasLoaded) return { ...state, isLoading: false };
      return { ...state, items: [], error: action.message, isLoading: false };

    case "refresh-failed":
      // Background refreshes are invisible by design, successful or not.
      return state;


    default:
      return state;
  }
}
