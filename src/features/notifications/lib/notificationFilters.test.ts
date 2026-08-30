import { describe, expect, it } from "vitest";
import { filterNotificationsForViewer } from "./notificationFilters";
import type { NotificationItem } from "../types";

function item(kind: string): NotificationItem {
  return {
    id: kind,
    kind,
    tokenId: "42",
    timestamp: 1_700_000_000,
    actor: { id: "0x1111111111111111111111111111111111111111" }
  };
}

// Undoing an action should not notify the person it was undone to: being told
// someone unliked your post is noise at best.
const RETRACTIONS = ["UNFOLLOWED", "POST_UNLIKED", "POST_UNSAVED", "COMMENT_UNLIKED", "COMMENT_UNSAVED"];
const KEPT = ["FOLLOWED", "POST_LIKED", "POST_SAVED", "POST_COMMENTED", "POST_TIPPED", "COMMENT_TIPPED"];

describe("filterNotificationsForViewer", () => {
  describe("as an ordinary viewer", () => {
    it.each(RETRACTIONS)("hides %s", (kind) => {
      expect(filterNotificationsForViewer([item(kind)], false)).toEqual([]);
    });

    it.each(KEPT)("keeps %s", (kind) => {
      expect(filterNotificationsForViewer([item(kind)], false)).toHaveLength(1);
    });

    it("keeps the surviving items in their original order", () => {
      const input = [item("POST_LIKED"), item("POST_UNLIKED"), item("FOLLOWED")];
      expect(filterNotificationsForViewer(input, false).map((n) => n.kind)).toEqual([
        "POST_LIKED",
        "FOLLOWED"
      ]);
    });

    it("keeps unrecognised kinds rather than dropping them", () => {
      // A newer subgraph may emit kinds this client has never heard of.
      expect(filterNotificationsForViewer([item("SOME_FUTURE_KIND")], false)).toHaveLength(1);
    });
  });

  describe("as the contract owner", () => {
    it.each(RETRACTIONS)("keeps %s, which moderation needs to see", (kind) => {
      expect(filterNotificationsForViewer([item(kind)], true)).toHaveLength(1);
    });

    it("returns the list untouched", () => {
      const input = [item("POST_UNLIKED"), item("FOLLOWED")];
      expect(filterNotificationsForViewer(input, true)).toBe(input);
    });
  });

  it("handles an empty list", () => {
    expect(filterNotificationsForViewer([], false)).toEqual([]);
    expect(filterNotificationsForViewer([], true)).toEqual([]);
  });
});
