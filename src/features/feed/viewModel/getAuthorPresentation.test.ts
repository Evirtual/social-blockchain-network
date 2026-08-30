import { describe, expect, it } from "vitest";
import { getAuthorPresentation } from "./getAuthorPresentation";
import { profileKey } from "@features/profile";
import { shortAddress } from "@shared/lib/format";

const ALICE = "0x91484B0e55C3d577602763784E34b5c08ABfdFcc";
const GUEST_HUE = 999;

// The same account, holding a different profile on each network.
const identity = new Map([
  [profileKey("84532", ALICE), { name: "Base Origin", hue: 220, avatarUrl: "ipfs://base" }],
  [profileKey("97", ALICE), { name: "BSC Origin", hue: 45, avatarUrl: "ipfs://bsc" }],
  [profileKey("11155111", ALICE), { name: "", hue: 223 }]
]);

function present(author: string | null | undefined, chainId?: string | null) {
  return getAuthorPresentation({ author, chainId, authorIdentity: identity, guestHue: GUEST_HUE });
}

describe("getAuthorPresentation", () => {
  describe("per-chain identity", () => {
    // Regression: identities were keyed by address alone, so whichever chain
    // resolved first labelled that author's posts on every network.
    it("uses the profile belonging to the post's own chain", () => {
      expect(present(ALICE, "84532").authorLabel).toBe("Base Origin");
      expect(present(ALICE, "97").authorLabel).toBe("BSC Origin");
    });

    it("gives each chain its own avatar", () => {
      expect(present(ALICE, "84532").authorAvatarUrl).toBe("ipfs://base");
      expect(present(ALICE, "97").authorAvatarUrl).toBe("ipfs://bsc");
    });

    it("falls back to the address on a chain with no profile", () => {
      expect(present(ALICE, "8453").authorLabel).toBe(shortAddress(ALICE));
    });
  });

  describe("falling back", () => {
    it("shows the shortened address when the profile has no name", () => {
      expect(present(ALICE, "11155111").authorLabel).toBe(shortAddress(ALICE));
    });

    it("shows the shortened address when the chain is unknown", () => {
      expect(present(ALICE, null).authorLabel).toBe(shortAddress(ALICE));
    });

    it("says Unknown when there is no author at all", () => {
      expect(present(null, "84532").authorLabel).toBe("Unknown");
      expect(present(undefined, "84532").authorLabel).toBe("Unknown");
    });

    it("uses the guest hue when no identity is found", () => {
      expect(present(ALICE, "8453").authorHue).toBe(GUEST_HUE);
      expect(present(null, "84532").authorHue).toBe(GUEST_HUE);
    });

    it("leaves the avatar undefined rather than empty when none is known", () => {
      expect(present(ALICE, "11155111").authorAvatarUrl).toBeUndefined();
    });
  });

  it("matches regardless of address casing", () => {
    expect(present(ALICE.toLowerCase(), "84532").authorLabel).toBe("Base Origin");
    expect(present(ALICE.toUpperCase().replace("0X", "0x"), "84532").authorLabel).toBe("Base Origin");
  });

  it("carries the hue from the resolved profile", () => {
    expect(present(ALICE, "84532").authorHue).toBe(220);
    expect(present(ALICE, "97").authorHue).toBe(45);
  });

  it("treats a blank name as no name", () => {
    const blank = new Map([[profileKey("84532", ALICE), { name: "   ", hue: 1 }]]);
    const result = getAuthorPresentation({
      author: ALICE,
      chainId: "84532",
      authorIdentity: blank,
      guestHue: GUEST_HUE
    });
    expect(result.authorLabel).toBe(shortAddress(ALICE));
  });
});
