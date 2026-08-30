import { describe, expect, it } from "vitest";
import { filterPosts } from "./filterPosts";
import type { Post } from "@types";
import { shortAddress } from "@shared/lib/format";

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

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";

const identity = new Map([[ALICE.toLowerCase(), { name: "Base Origin", hue: 200 }]]);

function filter(params: { posts: Post[]; searchQuery?: string; networks?: string[] }) {
  return filterPosts({
    posts: params.posts,
    authorIdentity: identity,
    searchQuery: params.searchQuery ?? "",
    selectedNetworkChainIds: params.networks ?? ["84532"]
  });
}

describe("filterPosts", () => {
  describe("network filtering", () => {
    it("keeps only posts on a selected network", () => {
      const posts = [post({ tokenId: "1", chainId: "84532" }), post({ tokenId: "2", chainId: "97" })];
      expect(filter({ posts, networks: ["84532"] }).map((p) => p.tokenId)).toEqual(["1"]);
    });

    it("keeps posts across several selected networks", () => {
      const posts = [post({ tokenId: "1", chainId: "84532" }), post({ tokenId: "2", chainId: "97" })];
      expect(filter({ posts, networks: ["84532", "97"] })).toHaveLength(2);
    });

    it("returns nothing when no network is selected", () => {
      // Deliberate: an empty selection means "show nothing", not "show all".
      // Clearing every network filter empties the feed rather than opening it up.
      const posts = [post({ tokenId: "1" }), post({ tokenId: "2", chainId: "97" })];
      expect(filter({ posts, networks: [] })).toEqual([]);
    });

    it("drops posts with no chain recorded", () => {
      const posts = [post({ tokenId: "1", chainId: undefined })];
      expect(filter({ posts, networks: ["84532"] })).toEqual([]);
    });
  });

  describe("search", () => {
    const posts = [
      post({ tokenId: "1", body: "Testing a post with a video", author: ALICE }),
      post({ tokenId: "2", body: "Something unrelated", author: BOB })
    ];

    it("ignores queries shorter than three characters", () => {
      // Short queries match almost everything, so they are treated as no filter.
      expect(filter({ posts, searchQuery: "te" })).toHaveLength(2);
      expect(filter({ posts, searchQuery: "" })).toHaveLength(2);
    });

    it("matches the post body", () => {
      expect(filter({ posts, searchQuery: "video" }).map((p) => p.tokenId)).toEqual(["1"]);
    });

    it("matches regardless of case", () => {
      expect(filter({ posts, searchQuery: "VIDEO" })).toHaveLength(1);
    });

    it("matches the author's profile name", () => {
      expect(filter({ posts, searchQuery: "Base Origin" }).map((p) => p.tokenId)).toEqual(["1"]);
    });

    it("matches the author's full address", () => {
      expect(filter({ posts, searchQuery: ALICE }).map((p) => p.tokenId)).toEqual(["1"]);
    });

    it("matches the shortened address as displayed", () => {
      // What is on screen is the shortened form, so that is what people type.
      expect(filter({ posts, searchQuery: shortAddress(ALICE) }).map((p) => p.tokenId)).toEqual(["1"]);
    });

    it("ignores surrounding whitespace", () => {
      expect(filter({ posts, searchQuery: "  video  " })).toHaveLength(1);
    });

    it("returns nothing when a query matches no post", () => {
      expect(filter({ posts, searchQuery: "zzzznomatch" })).toEqual([]);
    });

    it("searches only within the selected networks", () => {
      const mixed = [
        post({ tokenId: "1", body: "video", chainId: "84532" }),
        post({ tokenId: "2", body: "video", chainId: "97" })
      ];
      expect(filter({ posts: mixed, searchQuery: "video", networks: ["97"] }).map((p) => p.tokenId)).toEqual(["2"]);
    });
  });

  it("handles an empty feed", () => {
    expect(filter({ posts: [] })).toEqual([]);
    expect(filter({ posts: [], searchQuery: "video" })).toEqual([]);
  });
});
