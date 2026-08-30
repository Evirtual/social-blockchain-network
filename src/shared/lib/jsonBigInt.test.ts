import { describe, expect, it } from "vitest";
import { parseWithBigInt, stringifyWithBigInt } from "./jsonBigInt";

describe("stringifyWithBigInt / parseWithBigInt", () => {
  it("round-trips a BigInt that plain JSON cannot serialise at all", () => {
    // Regression: notification tip amounts are BigInt, so every cache write
    // threw and was swallowed, leaving the cache permanently empty.
    expect(() => JSON.stringify({ amountWei: 1299800000000000n })).toThrow(/BigInt/);

    const restored = parseWithBigInt<{ amountWei: bigint }>(
      stringifyWithBigInt({ amountWei: 1299800000000000n })
    );

    expect(restored.amountWei).toBe(1299800000000000n);
    expect(typeof restored.amountWei).toBe("bigint");
  });

  it("preserves precision beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = 123456789012345678901234567890n;
    const restored = parseWithBigInt<{ v: bigint }>(stringifyWithBigInt({ v: huge }));
    expect(restored.v).toBe(huge);
  });

  it("handles BigInt nested in arrays and objects", () => {
    const input = {
      items: [
        { id: "a", amountWei: 1n, actor: { since: 2n } },
        { id: "b", amountWei: null }
      ],
      ts: 1700000000000
    };

    const restored = parseWithBigInt<typeof input>(stringifyWithBigInt(input));

    expect(restored.items[0]?.amountWei).toBe(1n);
    expect(restored.items[0]?.actor?.since).toBe(2n);
    expect(restored.items[1]?.amountWei).toBeNull();
    expect(restored.ts).toBe(1700000000000);
  });

  it("leaves ordinary values untouched", () => {
    const input = { s: "text", n: 42, b: true, nil: null, arr: [1, "two"] };
    expect(parseWithBigInt(stringifyWithBigInt(input))).toEqual(input);
  });

  it("keeps zero and negative BigInt distinct from numbers", () => {
    const restored = parseWithBigInt<{ zero: bigint; neg: bigint }>(
      stringifyWithBigInt({ zero: 0n, neg: -5n })
    );
    expect(restored.zero).toBe(0n);
    expect(restored.neg).toBe(-5n);
  });

  it("reads back plain JSON written before this encoding existed", () => {
    // Existing cache entries must not break on upgrade.
    expect(parseWithBigInt<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });
});
