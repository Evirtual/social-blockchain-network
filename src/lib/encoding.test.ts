import { describe, expect, it } from "vitest";
import { fromBase64, toBase64 } from "./encoding";

describe("encoding", () => {
  it("roundtrips utf-8", () => {
    const value = "hello ✓ こんにちは";
    const enc = toBase64(value);
    expect(fromBase64(enc)).toBe(value);
  });
});
