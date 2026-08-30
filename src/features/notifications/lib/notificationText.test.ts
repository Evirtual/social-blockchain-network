import { describe, expect, it } from "vitest";
import { notificationActionText, notificationDetailText } from "./notificationText";
import type { NotificationItem, NotificationKind, ProtocolNotificationKind } from "../types";

// Every kind the app declares. Listed explicitly rather than derived, so adding
// a kind to the union without adding its text fails here.
const ALL_KINDS: Array<NotificationKind | ProtocolNotificationKind> = [
  "FOLLOWED",
  "UNFOLLOWED",
  "POST_LIKED",
  "POST_UNLIKED",
  "POST_SAVED",
  "POST_UNSAVED",
  "POST_COMMENTED",
  "POST_TIPPED",
  "POST_UPDATED_BY_ADMIN",
  "POST_FROZEN",
  "POST_REPORTED",
  "COMMENT_LIKED",
  "COMMENT_UNLIKED",
  "COMMENT_SAVED",
  "COMMENT_UNSAVED",
  "COMMENT_REPLIED",
  "COMMENT_TIPPED",
  "COMMENT_REPORTED",
  "POSTER_APPROVAL_REQUESTED",
  "POSTER_APPROVED",
  "POSTER_DISAPPROVED",
  "PROFILE_MODERATED",
  "PROFILE_CLEARED_BY_ADMIN",
  "POST_REMOVED_BY_ADMIN",
  "COMMENT_REMOVED",
  "PROTOCOL_SUPPORTED",
  "WITHDRAW_FEE_PAID"
];

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "1",
    kind: "POST_LIKED",
    tokenId: "42",
    timestamp: 1_700_000_000,
    actor: { id: "0x1111111111111111111111111111111111111111" },
    ...overrides
  };
}

describe("notificationActionText", () => {
  it("gives every declared kind its own wording", () => {
    const generic = notificationActionText("SOMETHING_UNKNOWN");
    const missing = ALL_KINDS.filter((kind) => notificationActionText(kind) === generic);
    expect(missing).toEqual([]);
  });

  it("does not reuse the same wording for two different kinds", () => {
    const texts = ALL_KINDS.map((kind) => notificationActionText(kind));
    expect(new Set(texts).size).toBe(ALL_KINDS.length);
  });

  it("distinguishes an action from its inverse", () => {
    expect(notificationActionText("POST_LIKED")).not.toBe(notificationActionText("POST_UNLIKED"));
    expect(notificationActionText("FOLLOWED")).not.toBe(notificationActionText("UNFOLLOWED"));
  });

  it("falls back for a kind the subgraph introduces later", () => {
    // Older clients must render something sane for a newer subgraph's kinds.
    expect(notificationActionText("SOME_FUTURE_KIND")).toBe("interacted with you");
    expect(notificationActionText("")).toBe("interacted with you");
  });
});

describe("notificationDetailText", () => {
  it.each([
    ["POSTER_APPROVAL_REQUESTED", "Posting approval requested"],
    ["POSTER_APPROVED", "Posting approved"],
    ["POSTER_DISAPPROVED", "Posting disapproved"],
    ["PROFILE_MODERATED", "Profile moderated"],
    ["PROFILE_CLEARED_BY_ADMIN", "Profile cleared"],
    ["FOLLOWED", "New follower"]
  ])("labels account-level kind %s", (kind, expected) => {
    expect(notificationDetailText(item({ kind }))).toBe(expected);
  });

  it("labels account-level kinds even when they carry no token", () => {
    // These are checked before the tokenId guard, so a "0" token must not
    // strip their label.
    expect(notificationDetailText(item({ kind: "FOLLOWED", tokenId: "0" }))).toBe("New follower");
  });

  it("returns nothing for post-level kinds with no token", () => {
    expect(notificationDetailText(item({ kind: "COMMENT_REPLIED", tokenId: "0" }))).toBe("");
  });

  it.each([
    ["COMMENT_REPLIED", "Reply to your comment"],
    ["COMMENT_REMOVED", "Comment removed"],
    ["COMMENT_REPORTED", "Comment reported"],
    ["POST_REPORTED", "Post reported"]
  ])("labels post-level kind %s when a token is present", (kind, expected) => {
    expect(notificationDetailText(item({ kind, tokenId: "42" }))).toBe(expected);
  });

  it("returns nothing for kinds that need no extra detail", () => {
    expect(notificationDetailText(item({ kind: "POST_LIKED" }))).toBe("");
    expect(notificationDetailText(item({ kind: "POST_TIPPED" }))).toBe("");
  });
});
