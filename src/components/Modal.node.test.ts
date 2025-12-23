// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasDocument } from "../lib/dom";

describe("Modal (node)", () => {
  it("hasDocument is false when document is unavailable", () => {
    expect(hasDocument()).toBe(false);
  });
});
