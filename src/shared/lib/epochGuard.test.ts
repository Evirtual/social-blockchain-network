import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEpochGuard, useEpochLoadingFlag, useEpochLoadingMap } from "./epochGuard";

function renderGuard() {
  return renderHook(() => {
    const guard = useEpochGuard();
    const [isLoading, setIsLoading] = useEpochLoadingFlag(guard);
    const [isLoadingByKey, setIsLoadingByKey] = useEpochLoadingMap(guard);
    return { guard, isLoading, setIsLoading, isLoadingByKey, setIsLoadingByKey };
  });
}

describe("useEpochGuard", () => {
  it("marks a snapshot stale once the epoch is bumped", () => {
    const { result } = renderGuard();
    const epoch = result.current.guard.snapshotEpoch();

    expect(result.current.guard.isStale(epoch)).toBe(false);
    act(() => result.current.guard.bumpEpoch());
    expect(result.current.guard.isStale(epoch)).toBe(true);
  });

  it("clears loading state it owns when the epoch is bumped", () => {
    // This is the whole point of routing loading state through the guard. A
    // stale request declines to clear its own flag, so if the bump does not
    // clear it, nothing does and the spinner is stranded.
    const { result } = renderGuard();

    act(() => {
      result.current.setIsLoading(true);
      result.current.setIsLoadingByKey({ "0xabc": true });
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isLoadingByKey["0xabc"]).toBe(true);

    act(() => result.current.guard.bumpEpoch());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoadingByKey["0xabc"]).toBeFalsy();
  });

  it("keeps the guard identity stable across renders, so registrations are not churned", () => {
    const { result, rerender } = renderGuard();
    const first = result.current.guard;
    rerender();
    expect(result.current.guard).toBe(first);
  });
});
