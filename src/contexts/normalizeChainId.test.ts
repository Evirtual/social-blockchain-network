import { describe, it, expect, vi } from "vitest";
import { normalizeChainId } from "../contexts/ComposerContext";

describe("normalizeChainId", () => {
  it("returns null for null or empty input", () => {
    expect(normalizeChainId(null)).toBeNull();
    expect(normalizeChainId(undefined as any)).toBeNull();
    expect(normalizeChainId("")).toBeNull();
  });

  it("parses hex and decimal strings", () => {
    expect(normalizeChainId("0x10")).toBe("16");
    expect(normalizeChainId("0X10")).toBe("16");
    expect(normalizeChainId("42")).toBe("42");
  });

  it("stringifies numeric chain ids", () => {
    expect(normalizeChainId(1)).toBe("1");
    expect(normalizeChainId(8453)).toBe("8453");
  });

  it("returns null for invalid input and triggers catch for bad hex", () => {
    expect(normalizeChainId("0xZZ")).toBeNull(); // triggers catch
    expect(normalizeChainId("notanumber")).toBeNull();
    expect(normalizeChainId({} as any)).toBeNull(); // non-string/number
  });

  it("returns null when parseInt throws (catch path)", () => {
    const originalParseInt = globalThis.parseInt;
    const throwingParseInt = (() => {
      throw new Error("boom");
    }) as any;

    try {
      vi.stubGlobal("parseInt", throwingParseInt);
      expect(normalizeChainId("0x10")).toBeNull();
    } finally {
      vi.stubGlobal("parseInt", originalParseInt);
    }
  });
});
