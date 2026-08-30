import { describe, expect, it } from "vitest";
import { profileKey } from "./profileKey";

const ADDRESS = "0x91484B0e55C3d577602763784E34b5c08ABfdFcc";

describe("profileKey", () => {
  it("separates the same address on different chains", () => {
    // Regression: one address holds an independent profile on each network.
    // Keying by address alone let whichever chain resolved first label that
    // author's posts on every other network too.
    const bsc = profileKey("97", ADDRESS);
    const base = profileKey("84532", ADDRESS);
    const eth = profileKey("11155111", ADDRESS);

    expect(new Set([bsc, base, eth]).size).toBe(3);
  });

  it("matches the same address on the same chain regardless of casing", () => {
    expect(profileKey("97", ADDRESS)).toBe(profileKey("97", ADDRESS.toLowerCase()));
    expect(profileKey("97", ADDRESS)).toBe(profileKey("97", ADDRESS.toUpperCase().replace("0X", "0x")));
  });

  it("accepts the chain id as a number or a string", () => {
    expect(profileKey(97, ADDRESS)).toBe(profileKey("97", ADDRESS));
  });

  it("ignores surrounding whitespace", () => {
    expect(profileKey(" 97 ", `  ${ADDRESS}  `)).toBe(profileKey("97", ADDRESS));
  });

  it("produces a stable key when the chain is unknown", () => {
    // No wallet connected and no post chain: still one consistent bucket
    // rather than a key that varies between null and undefined.
    expect(profileKey(null, ADDRESS)).toBe(profileKey(undefined, ADDRESS));
    expect(profileKey(null, ADDRESS)).not.toBe(profileKey("97", ADDRESS));
  });

  it("uses the chainId:address shape shared with the like/save caches", () => {
    expect(profileKey("97", ADDRESS)).toBe(`97:${ADDRESS.toLowerCase()}`);
  });
});
