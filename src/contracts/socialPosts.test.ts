import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { SOCIAL_ABI, getSocialContract, socialInterface } from "./socialPosts";

describe("socialPosts contract helpers", () => {
  it("exports a usable ABI and interface", () => {
    expect(Array.isArray(SOCIAL_ABI)).toBe(true);
    expect(SOCIAL_ABI.length).toBeGreaterThan(0);

    // Sanity: known event exists in the interface.
    expect(() => socialInterface.getEvent("PostMinted")).not.toThrow();
  });

  it("getSocialContract constructs an ethers.Contract", () => {
    const runner = new ethers.JsonRpcProvider("http://localhost:8545");
    const c = getSocialContract("0x000000000000000000000000000000000000dEaD", runner);
    expect(typeof (c as any).getAddress).toBe("function");
  });

  it("socialInterface can parse encoded event logs", () => {
    const iface = new ethers.Interface(SOCIAL_ABI);
    const tokenId = 123n;
    const author = "0x000000000000000000000000000000000000bEEF";
    const tokenURI = "ipfs://QmX";

    const minted = iface.getEvent("PostMinted");
    expect(minted).not.toBeNull();

    const { data, topics } = iface.encodeEventLog(minted!, [author, tokenId, tokenURI]);
    const parsed = socialInterface.parseLog({ data, topics });
    expect(parsed).not.toBeNull();

    const desc = parsed!;
    expect(desc.name).toBe("PostMinted");
    expect(desc.args[0]).toBe(author);
    expect((desc.args[1] as bigint).toString()).toBe("123");
    expect(desc.args[2]).toBe(tokenURI);
  });
});
