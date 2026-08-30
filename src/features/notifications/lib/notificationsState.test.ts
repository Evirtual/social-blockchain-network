import { describe, expect, it } from "vitest";
import {
  initialNotificationsState,
  notificationsReducer,
  type NotificationsAction,
  type NotificationsState
} from "./notificationsState";
import type { NotificationItem } from "../types";

function item(id: string): NotificationItem {
  return {
    id,
    kind: "POST_LIKED",
    tokenId: "42",
    timestamp: 1_700_000_000,
    actor: { id: "0x1111111111111111111111111111111111111111" }
  };
}

const LOADED = [item("a"), item("b")];

/** Applies a sequence of actions from the initial state. */
function run(...actions: NotificationsAction[]): NotificationsState {
  return actions.reduce(notificationsReducer, initialNotificationsState);
}

const loaded = (items = LOADED): NotificationsAction => ({
  type: "load-succeeded",
  items,
  schemaMismatch: false
});

describe("notificationsReducer", () => {
  describe("the flicker this exists to prevent", () => {
    it("keeps the list when a later load fails", () => {
      // The original defect: any error cleared items, so one failed request
      // blanked a list that had loaded perfectly well.
      const state = run(loaded(), { type: "load-started" }, { type: "load-failed", message: "boom" });

      expect(state.items).toEqual(LOADED);
      expect(state.error).toBe("");
    });

    it("does not oscillate across a failure and a recovery", () => {
      const after = [item("c")];
      const state = run(
        loaded(),
        { type: "refresh-failed" },
        { type: "load-failed", message: "boom" },
        { type: "refresh-succeeded", items: after, schemaMismatch: false }
      );

      expect(state.items).toEqual(after);
      expect(state.error).toBe("");
      expect(state.isLoading).toBe(false);
    });

    it("never reports an error while showing data", () => {
      const state = run(loaded(), { type: "load-failed", message: "boom" });
      expect(state.error && state.items.length).toBeFalsy();
    });

    it("never shows skeletons over a list already on screen", () => {
      const state = run(loaded(), { type: "load-started" });
      expect(state.isLoading).toBe(false);
      expect(state.items).toEqual(LOADED);
    });
  });

  describe("first load", () => {
    it("shows loading when there is nothing yet", () => {
      expect(run({ type: "load-started" }).isLoading).toBe(true);
    });

    it("reports the error when it has nothing to fall back on", () => {
      const state = run({ type: "load-started" }, { type: "load-failed", message: "network down" });

      expect(state.error).toBe("network down");
      expect(state.items).toEqual([]);
      expect(state.isLoading).toBe(false);
    });

    it("clears a previous error once a load succeeds", () => {
      const state = run({ type: "load-failed", message: "boom" }, loaded());
      expect(state.error).toBe("");
      expect(state.items).toEqual(LOADED);
    });
  });

  describe("empty results", () => {
    it("treats an empty successful load as a real answer", () => {
      // "You have no notifications" is data, not a failure.
      const state = run(loaded(), { type: "refresh-succeeded", items: [], schemaMismatch: false });
      expect(state.items).toEqual([]);
      expect(state.error).toBe("");
    });

    it("marks itself loaded even when the first result is empty", () => {
      const state = run({ type: "load-started" }, loaded([]));
      expect(state.hasLoaded).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("background refreshes", () => {
    it("ignores a failed refresh entirely", () => {
      const before = run(loaded());
      expect(notificationsReducer(before, { type: "refresh-failed" })).toBe(before);
    });

    it("applies a successful refresh", () => {
      const next = [item("z")];
      const state = run(loaded(), { type: "refresh-succeeded", items: next, schemaMismatch: false });
      expect(state.items).toEqual(next);
    });
  });

  describe("schema mismatch", () => {
    it("is carried from whichever load reported it", () => {
      const state = run({ type: "load-succeeded", items: [], schemaMismatch: true });
      expect(state.schemaMismatch).toBe(true);
    });

    it("clears when a later load reports no mismatch", () => {
      const state = run({ type: "load-succeeded", items: [], schemaMismatch: true }, loaded());
      expect(state.schemaMismatch).toBe(false);
    });
  });

  describe("demo seeding", () => {
    it("seeds only into an empty list", () => {
      const demo = [item("demo")];
      expect(run({ type: "seed-demo", items: demo }).items).toEqual(demo);
    });

    it("never displaces real data", () => {
      const state = run(loaded(), { type: "seed-demo", items: [item("demo")] });
      expect(state.items).toEqual(LOADED);
    });
  });

  describe("reset", () => {
    it("returns to the initial state on a wallet or chain change", () => {
      const state = run(loaded(), { type: "reset" });
      expect(state).toEqual(initialNotificationsState);
    });
  });
});
