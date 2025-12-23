import { describe, expect, it } from "vitest";
import { shortAddress, stableHueFromSeed } from "./format";

describe("format", () => {
  it("shortAddress truncates", () => {
    const addr = "0x000000000000000000000000000000000000dEaD";
    expect(shortAddress(addr)).toBe("0x0000…dEaD");
  });

  it("stableHueFromSeed is deterministic and bounded", () => {
    const a = stableHueFromSeed("abc");
    const b = stableHueFromSeed("abc");
    const c = stableHueFromSeed("abcd");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
    expect(c).not.toBe(a);
  });
});
