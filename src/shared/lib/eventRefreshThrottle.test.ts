import { describe, expect, it, vi } from "vitest";
import { createEventRefreshThrottle, isSelfOnlyEvent } from "./eventRefreshThrottle";

/** Drives the throttle on a clock we control, so no real time passes. */
function harness(intervalMs = 15_000) {
  let clock = 1_000_000;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextId = 1;

  const onRefresh = vi.fn();
  const throttle = createEventRefreshThrottle({
    onRefresh,
    intervalMs,
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: clock + ms, fn });
      return id;
    },
    clearTimer: (id) => void timers.delete(id)
  });

  const advance = (ms: number) => {
    clock += ms;
    for (const [id, timer] of Array.from(timers)) {
      if (timer.at <= clock) {
        timers.delete(id);
        timer.fn();
      }
    }
  };

  return { throttle, onRefresh, advance, pendingTimers: () => timers.size };
}

describe("createEventRefreshThrottle", () => {
  it("refreshes immediately on the first event", () => {
    const { throttle, onRefresh } = harness();
    expect(throttle.request()).toBe(true);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("collapses a burst into one immediate and one trailing refresh", () => {
    const { throttle, onRefresh, advance } = harness(15_000);

    // A hundred events from across the network, all within the window.
    for (let i = 0; i < 100; i++) throttle.request();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    advance(15_000);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes again once the window has passed", () => {
    const { throttle, onRefresh, advance } = harness(15_000);

    throttle.request();
    advance(20_000);
    expect(throttle.request()).toBe(true);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("does not queue more than one trailing refresh", () => {
    const { throttle, advance, pendingTimers, onRefresh } = harness(15_000);

    throttle.request();
    throttle.request();
    throttle.request();
    expect(pendingTimers()).toBe(1);

    advance(15_000);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("bounds request rate over sustained activity", () => {
    const { throttle, onRefresh, advance } = harness(15_000);

    // One event per second for two minutes.
    for (let i = 0; i < 120; i++) {
      throttle.request();
      advance(1_000);
    }

    // Without throttling this would be 120 refreshes.
    expect(onRefresh.mock.calls.length).toBeLessThanOrEqual(9);
    expect(onRefresh.mock.calls.length).toBeGreaterThan(0);
  });

  it("stops a queued refresh when cancelled", () => {
    const { throttle, onRefresh, advance } = harness(15_000);

    throttle.request();
    throttle.request();
    throttle.cancel();
    advance(60_000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("isSelfOnlyEvent", () => {
  const me = "0x1111111111111111111111111111111111111111";
  const other = "0x2222222222222222222222222222222222222222";

  it("recognises an action by the user on their own account", () => {
    // e.g. TipsWithdrawn(author) — nothing to notify the user about.
    expect(isSelfOnlyEvent({ args: [me, 1000n] }, me)).toBe(true);
  });

  it("keeps events where someone else is involved", () => {
    // PostTipped(tipper, author, ...) — the user is the recipient here.
    expect(isSelfOnlyEvent({ args: [other, me, 1n] }, me)).toBe(false);
  });

  it("keeps events the user did to someone else", () => {
    // The other party may still be relevant to what is on screen.
    expect(isSelfOnlyEvent({ args: [me, other] }, me)).toBe(false);
  });

  it("is case insensitive about address formatting", () => {
    expect(isSelfOnlyEvent({ args: [me.toUpperCase().replace("0X", "0x")] }, me)).toBe(true);
  });

  it("keeps events with no addresses at all", () => {
    expect(isSelfOnlyEvent({ args: [1n, "hello"] }, me)).toBe(false);
    expect(isSelfOnlyEvent({ args: [] }, me)).toBe(false);
  });

  it("keeps everything when no wallet is connected", () => {
    expect(isSelfOnlyEvent({ args: [me] }, null)).toBe(false);
    expect(isSelfOnlyEvent({ args: [me] }, "")).toBe(false);
  });
});
