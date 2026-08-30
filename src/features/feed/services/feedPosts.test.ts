import { describe, expect, it } from "vitest";
import { mergePosts, sortPostsNewestFirst } from "./feedPosts";
import type { Post } from "@types";

const postKey = (p: Pick<Post, "tokenId" | "chainId">) => `${p.chainId ?? ""}:${p.tokenId}`;

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

describe("sortPostsNewestFirst", () => {
  it("orders by mint timestamp, newest first", () => {
    const items = [post({ tokenId: "1", mintTimestamp: 100 }), post({ tokenId: "2", mintTimestamp: 300 })];
    sortPostsNewestFirst(items, postKey);
    expect(items.map((p) => p.tokenId)).toEqual(["2", "1"]);
  });

  it("falls back to block number when timestamps match", () => {
    // Several posts can share a timestamp within one block window.
    const items = [
      post({ tokenId: "1", mintTimestamp: 100, mintBlockNumber: 5 }),
      post({ tokenId: "2", mintTimestamp: 100, mintBlockNumber: 9 })
    ];
    sortPostsNewestFirst(items, postKey);
    expect(items.map((p) => p.tokenId)).toEqual(["2", "1"]);
  });

  it("falls back to the key so the order is never arbitrary", () => {
    const items = [
      post({ tokenId: "1", mintTimestamp: 100, mintBlockNumber: 5 }),
      post({ tokenId: "2", mintTimestamp: 100, mintBlockNumber: 5 })
    ];
    sortPostsNewestFirst(items, postKey);
    expect(items.map((p) => p.tokenId)).toEqual(["2", "1"]);
  });

  it("treats missing timestamps as oldest", () => {
    const items = [post({ tokenId: "1" }), post({ tokenId: "2", mintTimestamp: 50 })];
    sortPostsNewestFirst(items, postKey);
    expect(items[0]?.tokenId).toBe("2");
  });
});

describe("mergePosts", () => {
  it("returns the same array when there is nothing incoming", () => {
    const prev = [post({ tokenId: "1" })];
    expect(mergePosts(prev, [], postKey)).toBe(prev);
  });

  it("adds posts that are not already present", () => {
    const merged = mergePosts([post({ tokenId: "1", mintTimestamp: 1 })], [post({ tokenId: "2", mintTimestamp: 2 })], postKey);
    expect(merged.map((p) => p.tokenId)).toEqual(["2", "1"]);
  });

  it("keeps posts from different chains apart even with the same token id", () => {
    // Token ids restart per deployment, so only chain plus token identifies a post.
    const merged = mergePosts(
      [post({ tokenId: "1", chainId: "84532" })],
      [post({ tokenId: "1", chainId: "97" })],
      postKey
    );
    expect(merged).toHaveLength(2);
  });

  it("replaces a post whose counts have changed", () => {
    const merged = mergePosts([post({ tokenId: "1", likes: 1 })], [post({ tokenId: "1", likes: 2 })], postKey);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.likes).toBe(2);
  });

  describe("preserving the array reference", () => {
    // The feed re-renders on every refresh; returning a new array for identical
    // data would rebuild the whole list for nothing.
    it("keeps the reference when incoming data is equivalent", () => {
      const prev = [post({ tokenId: "1", likes: 3, tipsWei: 5n })];
      const incoming = [post({ tokenId: "1", likes: 3, tipsWei: 5n })];
      expect(mergePosts(prev, incoming, postKey)).toBe(prev);
    });

    it("keeps the reference when only the context tag differs", () => {
      // contextTag is page-level UI state, not post data.
      const prev = [post({ tokenId: "1" })];
      const incoming = [post({ tokenId: "1", contextTag: "saved" })];
      expect(mergePosts(prev, incoming, postKey)).toBe(prev);
    });

    it("returns a new array once anything real changes", () => {
      const prev = [post({ tokenId: "1", likes: 1 })];
      expect(mergePosts(prev, [post({ tokenId: "1", likes: 2 })], postKey)).not.toBe(prev);
    });
  });

  describe("fields that count as a change", () => {
    it.each([
      ["likes", { likes: 9 }],
      ["comments", { comments: 9 }],
      ["saves", { saves: 9 }],
      ["tipsWei", { tipsWei: 9n }],
      ["body", { body: "edited" }],
      ["title", { title: "edited" }],
      ["image", { image: "ipfs://other" }],
      ["likedByMe", { likedByMe: true }],
      ["savedByMe", { savedByMe: true }]
    ])("detects a change in %s", (_label, change) => {
      const prev = [post({ tokenId: "1" })];
      const merged = mergePosts(prev, [post({ tokenId: "1", ...change })], postKey);
      expect(merged).not.toBe(prev);
    });
  });

  it("sorts the merged result newest first", () => {
    const merged = mergePosts(
      [post({ tokenId: "1", mintTimestamp: 10 })],
      [post({ tokenId: "2", mintTimestamp: 30 }), post({ tokenId: "3", mintTimestamp: 20 })],
      postKey
    );
    expect(merged.map((p) => p.tokenId)).toEqual(["2", "3", "1"]);
  });
});
