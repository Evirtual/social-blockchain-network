import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countUnreadNotifications,
  maxNotificationTimestamp,
  notificationsLastSeenKey,
  onNotificationsLastSeenChanged,
  readNotificationsLastSeen,
  writeNotificationsLastSeen
} from "./notificationReadState";
import type { NotificationItem } from "../types";

function item(timestamp: number, id = String(timestamp)): NotificationItem {
  return {
    id,
    kind: "POST_LIKED",
    tokenId: "42",
    timestamp,
    actor: { id: "0x1111111111111111111111111111111111111111" }
  };
}

const WALLET = "0x91484B0e55C3d577602763784E34b5c08ABfdFcc";

beforeEach(() => localStorage.clear());

describe("notificationsLastSeenKey", () => {
  it("scopes the mark by chain and wallet", () => {
    // Read state is per account per network; sharing one key would mark
    // another chain's notifications as seen.
    expect(notificationsLastSeenKey("84532", WALLET)).not.toBe(notificationsLastSeenKey("97", WALLET));
    expect(notificationsLastSeenKey("84532", WALLET)).not.toBe(
      notificationsLastSeenKey("84532", "0x2222222222222222222222222222222222222222")
    );
  });

  it("normalises casing and whitespace", () => {
    expect(notificationsLastSeenKey(" 84532 ", WALLET)).toBe(
      notificationsLastSeenKey("84532", WALLET.toLowerCase())
    );
  });

  it("uses a placeholder rather than an empty segment when either is missing", () => {
    expect(notificationsLastSeenKey(null, null)).toContain("unknown");
  });
});

describe("readNotificationsLastSeen / writeNotificationsLastSeen", () => {
  it("round-trips a timestamp", () => {
    writeNotificationsLastSeen("84532", WALLET, 1_700_000_000);
    expect(readNotificationsLastSeen("84532", WALLET)).toBe(1_700_000_000);
  });

  it("returns zero when nothing has been marked", () => {
    expect(readNotificationsLastSeen("84532", WALLET)).toBe(0);
  });

  it("keeps chains independent", () => {
    writeNotificationsLastSeen("84532", WALLET, 1_700_000_000);
    expect(readNotificationsLastSeen("97", WALLET)).toBe(0);
  });

  it("returns zero for corrupted storage rather than NaN", () => {
    localStorage.setItem(notificationsLastSeenKey("84532", WALLET), "not json");
    expect(readNotificationsLastSeen("84532", WALLET)).toBe(0);
  });
});

describe("onNotificationsLastSeenChanged", () => {
  it("notifies subscribers on write", () => {
    const handler = vi.fn();
    const off = onNotificationsLastSeenChanged(handler);

    writeNotificationsLastSeen("84532", WALLET, 1_700_000_000);

    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("stops notifying after unsubscribe", () => {
    const handler = vi.fn();
    onNotificationsLastSeenChanged(handler)();

    writeNotificationsLastSeen("84532", WALLET, 1_700_000_000);

    expect(handler).not.toHaveBeenCalled();
  });

  it("fires even when the timestamp is unchanged", () => {
    // Documents current behaviour: the event is unconditional, so every write
    // wakes subscribers whether or not anything actually moved.
    const handler = vi.fn();
    const off = onNotificationsLastSeenChanged(handler);

    writeNotificationsLastSeen("84532", WALLET, 1_700_000_000);
    writeNotificationsLastSeen("84532", WALLET, 1_700_000_000);

    expect(handler).toHaveBeenCalledTimes(2);
    off();
  });
});

describe("maxNotificationTimestamp", () => {
  it("finds the newest timestamp regardless of order", () => {
    expect(maxNotificationTimestamp([item(5), item(99), item(20)])).toBe(99);
  });

  it("returns zero for an empty list", () => {
    expect(maxNotificationTimestamp([])).toBe(0);
  });

  it("ignores items with a missing timestamp", () => {
    const broken = { ...item(0), timestamp: undefined } as unknown as NotificationItem;
    expect(maxNotificationTimestamp([broken, item(7)])).toBe(7);
  });
});

describe("countUnreadNotifications", () => {
  it("counts only items newer than the mark", () => {
    expect(countUnreadNotifications([item(10), item(20), item(30)], 20)).toBe(1);
  });

  it("treats an item exactly at the mark as read", () => {
    expect(countUnreadNotifications([item(20)], 20)).toBe(0);
  });

  it("counts everything when nothing has been seen", () => {
    expect(countUnreadNotifications([item(10), item(20)], 0)).toBe(2);
  });

  it("counts nothing for an empty list", () => {
    expect(countUnreadNotifications([], 0)).toBe(0);
  });
});
