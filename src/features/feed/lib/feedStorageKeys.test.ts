import { describe, expect, it } from "vitest";
import { getFeedStorageKeys } from "./feedStorageKeys";

const ADDRESS = "0x91484B0e55C3d577602763784E34b5c08ABfdFcc";

describe("getFeedStorageKeys", () => {
  it("gives the home feed its own search key", () => {
    expect(getFeedStorageKeys({ kind: "home" }).searchQueryKey).toContain("home");
  });

  it("gives each profile its own search key", () => {
    // Searching on someone's profile should not leak into the home feed or
    // into another profile.
    const other = "0x2222222222222222222222222222222222222222";
    const a = getFeedStorageKeys({ kind: "profile", address: ADDRESS }).searchQueryKey;
    const b = getFeedStorageKeys({ kind: "profile", address: other }).searchQueryKey;
    const home = getFeedStorageKeys({ kind: "home" }).searchQueryKey;

    expect(new Set([a, b, home]).size).toBe(3);
  });

  it("normalises address casing so one profile has one key", () => {
    expect(getFeedStorageKeys({ kind: "profile", address: ADDRESS }).searchQueryKey).toBe(
      getFeedStorageKeys({ kind: "profile", address: ADDRESS.toLowerCase() }).searchQueryKey
    );
  });

  it("ignores surrounding whitespace in the address", () => {
    expect(getFeedStorageKeys({ kind: "profile", address: `  ${ADDRESS}  ` }).searchQueryKey).toBe(
      getFeedStorageKeys({ kind: "profile", address: ADDRESS }).searchQueryKey
    );
  });

  it("falls back to a shared profile key when no address is given", () => {
    const missing = getFeedStorageKeys({ kind: "profile" }).searchQueryKey;
    const empty = getFeedStorageKeys({ kind: "profile", address: "   " }).searchQueryKey;

    expect(missing).toBe(empty);
    expect(missing).not.toContain("undefined");
    expect(missing).not.toContain("null");
  });

  it("shares one network selection across every scope", () => {
    // The chosen networks are a global preference: picking them on a profile
    // and returning home should not silently change what the feed shows.
    const home = getFeedStorageKeys({ kind: "home" }).selectedNetworksKey;
    const profile = getFeedStorageKeys({ kind: "profile", address: ADDRESS }).selectedNetworksKey;

    expect(home).toBe(profile);
  });

  it("namespaces every key to the app", () => {
    const keys = getFeedStorageKeys({ kind: "home" });
    expect(keys.searchQueryKey.startsWith("socialBlockchainNetwork.")).toBe(true);
    expect(keys.selectedNetworksKey.startsWith("socialBlockchainNetwork.")).toBe(true);
  });
});
