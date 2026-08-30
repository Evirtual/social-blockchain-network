import { describe, expect, it } from "vitest";
import { computeCommentsFromBlock, findMintBlockHint } from "./computeCommentsFromBlock";
import type { Post } from "@types";

function post(overrides: Partial<Post> & Pick<Post, "tokenId">): Post {
  return {
    chainId: "84532",
    title: "",
    body: "",
    image: "",
    metadataURI: "",
    likes: 0,
    comments: 0,
    saves: 0,
    tipsWei: 0n,
    ...overrides
  };
}

describe("computeCommentsFromBlock", () => {
  it("resumes from just after the last scanned block", () => {
    // Rescanning a block already covered would duplicate its comments.
    const from = computeCommentsFromBlock({
      latestBlock: 1_000_000,
      cachedLastScannedBlock: 900_000,
      mintHintBlockNumber: 500_000
    });
    expect(from).toBe(900_001);
  });

  it("starts at the post's mint block when nothing has been scanned", () => {
    // A post can have no comments before it existed, so scanning earlier is waste.
    const from = computeCommentsFromBlock({
      latestBlock: 1_000_000,
      cachedLastScannedBlock: null,
      mintHintBlockNumber: 500_000
    });
    expect(from).toBe(500_000);
  });

  it("falls back to a bounded window with no mint block known", () => {
    const from = computeCommentsFromBlock({
      latestBlock: 1_000_000,
      cachedLastScannedBlock: null,
      mintHintBlockNumber: undefined
    });
    expect(from).toBe(975_000);
  });

  it("never scans from before genesis on a young chain", () => {
    const from = computeCommentsFromBlock({
      latestBlock: 100,
      cachedLastScannedBlock: null,
      mintHintBlockNumber: undefined
    });
    expect(from).toBe(0);
  });

  it("ignores a nonsensical mint block", () => {
    for (const hint of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const from = computeCommentsFromBlock({
        latestBlock: 1_000_000,
        cachedLastScannedBlock: null,
        mintHintBlockNumber: hint
      });
      expect(from).toBe(975_000);
    }
  });

  it("floors a fractional mint block", () => {
    const from = computeCommentsFromBlock({
      latestBlock: 1_000_000,
      cachedLastScannedBlock: null,
      mintHintBlockNumber: 500_000.9
    });
    expect(from).toBe(500_000);
  });

  it("prefers the cache even when it predates the mint block", () => {
    const from = computeCommentsFromBlock({
      latestBlock: 1_000_000,
      cachedLastScannedBlock: 10,
      mintHintBlockNumber: 500_000
    });
    expect(from).toBe(11);
  });
});

describe("findMintBlockHint", () => {
  const posts = [
    post({ tokenId: "1", chainId: "84532", mintBlockNumber: 111 }),
    post({ tokenId: "1", chainId: "97", mintBlockNumber: 222 }),
    post({ tokenId: "2", chainId: "84532", mintBlockNumber: 333 })
  ];

  it("finds the mint block for a post on a given chain", () => {
    expect(findMintBlockHint(posts, "1", "84532")).toBe(111);
  });

  it("does not take the block from the same token on another chain", () => {
    // Token ids repeat across deployments; the wrong one would scan from a
    // block number that means nothing on this chain.
    expect(findMintBlockHint(posts, "1", "97")).toBe(222);
  });

  it("returns nothing for a post it has not seen", () => {
    expect(findMintBlockHint(posts, "999", "84532")).toBeUndefined();
  });

  it("matches on token alone when no chain is given", () => {
    expect(findMintBlockHint(posts, "2")).toBe(333);
  });

  it("skips a post with no chain when a chain was asked for", () => {
    const unchained = [post({ tokenId: "5", chainId: undefined, mintBlockNumber: 444 })];
    expect(findMintBlockHint(unchained, "5", "84532")).toBeUndefined();
  });

  it("returns nothing when the post has no mint block recorded", () => {
    expect(findMintBlockHint([post({ tokenId: "7" })], "7", "84532")).toBeUndefined();
  });
});
