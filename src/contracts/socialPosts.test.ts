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

    const { data, topics } = iface.encodeEventLog(iface.getEvent("PostMinted"), [author, tokenId, tokenURI]);
    const parsed = socialInterface.parseLog({ data, topics });

    expect(parsed.name).toBe("PostMinted");
    expect(parsed.args[0]).toBe(author);
    expect((parsed.args[1] as bigint).toString()).toBe("123");
    expect(parsed.args[2]).toBe(tokenURI);
  });
});
