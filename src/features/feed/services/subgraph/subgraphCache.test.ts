import { describe, expect, it } from "vitest";
import {
  buildAuthorCountCacheKey,
  buildRemoteSearchCacheKey,
  buildTotalCountCacheKey,
  setCacheWithCap,
  stableIdsKey
} from "./subgraphCache";

describe("stableIdsKey", () => {
  it("is independent of the order the networks were selected in", () => {
    // Picking Base then BSC must reuse the entry cached for BSC then Base.
    expect(stableIdsKey(["84532", "97"])).toBe(stableIdsKey(["97", "84532"]));
  });

  it("does not mutate the array it is given", () => {
    const ids = ["97", "84532"];
    stableIdsKey(ids);
    expect(ids).toEqual(["97", "84532"]);
  });

  it("distinguishes different selections", () => {
    expect(stableIdsKey(["84532"])).not.toBe(stableIdsKey(["84532", "97"]));
  });

  it("handles an empty selection", () => {
    expect(stableIdsKey([])).toBe("");
  });
});

describe("cache keys", () => {
  it("keeps total and author counts in separate namespaces", () => {
    expect(buildTotalCountCacheKey(["84532"])).not.toBe(
      buildAuthorCountCacheKey({ authorAddress: "84532", selectedChainIds: [] })
    );
  });

  it("separates authors from one another", () => {
    const a = buildAuthorCountCacheKey({ authorAddress: "0xaaa", selectedChainIds: ["84532"] });
    const b = buildAuthorCountCacheKey({ authorAddress: "0xbbb", selectedChainIds: ["84532"] });
    expect(a).not.toBe(b);
  });

  describe("remote search", () => {
    const base = {
      searchQuery: "video",
      authorFilter: "",
      walletAddress: null,
      selectedChainIds: ["84532"]
    };

    it("reuses the key for an identical search", () => {
      expect(buildRemoteSearchCacheKey(base)).toBe(buildRemoteSearchCacheKey({ ...base }));
    });

    it.each([
      ["query", { searchQuery: "image" }],
      ["author filter", { authorFilter: "0xaaa" }],
      ["viewer", { walletAddress: "0xbbb" }],
      ["networks", { selectedChainIds: ["97"] }]
    ])("varies with the %s", (_label, change) => {
      expect(buildRemoteSearchCacheKey({ ...base, ...change })).not.toBe(buildRemoteSearchCacheKey(base));
    });

    it("treats no wallet and an empty wallet alike", () => {
      expect(buildRemoteSearchCacheKey({ ...base, walletAddress: null })).toBe(
        buildRemoteSearchCacheKey({ ...base, walletAddress: "" })
      );
    });
  });
});

describe("setCacheWithCap", () => {
  it("stores the value", () => {
    const cache = new Map<string, number>();
    setCacheWithCap(cache, "a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("evicts the oldest entry once the cap is passed", () => {
    const cache = new Map<string, number>();
    setCacheWithCap(cache, "a", 1, 2);
    setCacheWithCap(cache, "b", 2, 2);
    setCacheWithCap(cache, "c", 3, 2);

    expect(cache.has("a")).toBe(false);
    expect(cache.size).toBe(2);
  });

  it("keeps the cache at the cap rather than above it", () => {
    const cache = new Map<string, number>();
    for (let i = 0; i < 20; i++) setCacheWithCap(cache, `k${i}`, i, 5);
    expect(cache.size).toBe(5);
  });

  it("evicts by insertion order, not by use", () => {
    // Documents the current behaviour: re-reading an entry does not protect it.
    const cache = new Map<string, number>();
    setCacheWithCap(cache, "a", 1, 2);
    setCacheWithCap(cache, "b", 2, 2);
    cache.get("a");
    setCacheWithCap(cache, "c", 3, 2);

    expect(cache.has("a")).toBe(false);
  });

  it("refreshing an existing key does not grow the cache", () => {
    const cache = new Map<string, number>();
    setCacheWithCap(cache, "a", 1, 2);
    setCacheWithCap(cache, "a", 9, 2);

    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe(9);
  });
});
