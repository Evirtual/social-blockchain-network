import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { FeedProvider, useFeed } from "./FeedContext";
import { socialInterface } from "../contracts/socialPosts";
import { fetchTokenMetadata } from "../lib/metadata";

const setStatus = vi.fn();

const walletState: {
  provider: any;
  walletAddress: string | null;
  chainId: string | null;
  walletEpoch: number;
} = {
  provider: null,
  walletAddress: "0xabc",
  chainId: "1",
  walletEpoch: 0
};

const readContract: any = {
  filters: {
    PostMinted: () => "PostMintedFilter",
    PostCommented: (_: any, __: any) => "PostCommentedFilter"
  },
  queryFilter: vi.fn(async (filter: string) => {
    if (filter === "PostMintedFilter") return [{ args: ["0xAuthor", 1n] }];

    return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
  }),
  exists: vi.fn(async (_: bigint) => true),
  tokenURI: vi.fn(async (_: bigint) => "ipfs://meta"),
  likesOf: vi.fn(async (_: bigint) => 2n),
  commentsOf: vi.fn(async (_: bigint) => 1n),
  sharesOf: vi.fn(async (_: bigint) => 0n),
  tipsOf: vi.fn(async (_: bigint) => 0n),
  authorOf: vi.fn(async (_: bigint) => "0xAuthor"),
  hasLiked: vi.fn(async (_: bigint, __: string) => true),
  hasShared: vi.fn(async (_: bigint, __: string) => false)
};

vi.mock("./WalletContext", () => ({
  useWallet: () => walletState
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ status: "", setStatus })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    ensureContractDeployedOnCurrentNetwork: vi.fn(async () => undefined),
    getReadContract: vi.fn(async () => readContract)
  })
}));

vi.mock("../lib/metadata", () => ({
  fetchTokenMetadata: vi.fn(async (_uri: string) => ({
    name: "Hello",
    description: "World",
    image: "ipfs://img"
  }))
}));

vi.mock("../contracts/socialPosts", () => ({
  socialInterface: {
    parseLog: vi.fn(() => ({
      args: { commenter: "0xC", comment: "Nice" }
    }))
  }
}));

function Consumer() {
  const feed = useFeed();
  const first = feed.posts[0] ?? null;
  return (
    <div>
      <div data-testid="count">{feed.posts.length}</div>
      <div data-testid="comments">{(feed.postComments["1"] ?? []).length}</div>
      <div data-testid="title0">{first?.title ?? ""}</div>
      <div data-testid="body0">{first?.body ?? ""}</div>
      <div data-testid="image0">{first?.image ?? ""}</div>
      <div data-testid="liked0">{String(first?.likedByMe)}</div>
      <div data-testid="reposted0">{String(first?.repostedByMe)}</div>
      <button type="button" onClick={() => feed.refreshFeed()}>
        refresh
      </button>
      <button type="button" onClick={() => feed.loadCommentsForPost("1")}>
        comments
      </button>
      <button type="button" onClick={() => feed.loadPostsByTokenIds(["1", "1"])}>
        loadByIdsExisting
      </button>
      <button type="button" onClick={() => feed.loadPostsByTokenIds(["2", "2"])}>
        loadByIdsNew
      </button>
      <button type="button" onClick={() => feed.loadPostsByTokenIds([])}>
        loadByIdsEmpty
      </button>
    </div>
  );
}

describe("FeedContext", () => {
  beforeEach(() => {
    walletState.provider = null;
    walletState.walletAddress = "0xabc";
    walletState.chainId = "1";
    walletState.walletEpoch = 0;

    setStatus.mockClear();

    readContract.queryFilter.mockReset();
    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") return [{ args: ["0xAuthor", 1n] }];
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });

    readContract.exists.mockReset();
    readContract.exists.mockImplementation(async (_: bigint) => true);

    readContract.tokenURI.mockReset();
    readContract.tokenURI.mockImplementation(async (_: bigint) => "ipfs://meta");

    readContract.likesOf.mockReset();
    readContract.likesOf.mockImplementation(async (_: bigint) => 2n);

    readContract.commentsOf.mockReset();
    readContract.commentsOf.mockImplementation(async (_: bigint) => 1n);

    readContract.sharesOf.mockReset();
    readContract.sharesOf.mockImplementation(async (_: bigint) => 0n);

    readContract.tipsOf.mockReset();
    readContract.tipsOf.mockImplementation(async (_: bigint) => 0n);

    readContract.authorOf.mockReset();
    readContract.authorOf.mockImplementation(async (_: bigint) => "0xAuthor");

    readContract.hasLiked.mockReset();
    readContract.hasLiked.mockImplementation(async (_: bigint, __: string) => true);

    readContract.hasShared.mockReset();
    readContract.hasShared.mockImplementation(async (_: bigint, __: string) => false);
  });

  it("loads posts by token IDs and ignores duplicates/existing", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };

    // Existing post will be tokenId 1 from initial refresh.
    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    readContract.exists.mockImplementation(async (id: bigint) => id === 1n || id === 2n);
    readContract.tokenURI.mockImplementation(async (id: bigint) => (id === 2n ? "ipfs://meta2" : "ipfs://meta"));

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
  });

  it("loads posts on mount and on refresh", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = "0xabc";

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    expect(setStatus).toHaveBeenCalled();

    await act(async () => {
      screen.getByText("refresh").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });

  it("caches in-flight comment loads", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // Kick off two loads without awaiting the first.
    await act(async () => {
      const btn = screen.getByText("comments");
      btn.click();
      btn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("comments").textContent).toBe("1");
    });

    // Ensure queryFilter for comments was hit (but not necessarily twice).
    expect(readContract.queryFilter).toHaveBeenCalled();
  });

  it("reacts to walletEpoch + chain changes", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";

    const { rerender } = render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    walletState.chainId = "8453";
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => {
      expect(setStatus).toHaveBeenCalled();
    });
  });

  it("reacts to walletEpoch + account changes", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = "0xabc";

    const { rerender } = render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    walletState.walletAddress = null;
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Wallet disconnected"));
  });

  it("refreshFeed shrinks log window on provider errors", async () => {
    // Set latest high enough to see fromBlock change as window shrinks.
    walletState.provider = { getBlockNumber: vi.fn(async () => 500_000) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = "0xabc";

    // Fail when fromBlock is too early, succeed when shrunk.
    readContract.queryFilter.mockImplementation(async (_filter: any, fromBlock: number) => {
      if (fromBlock <= 350_000) throw new Error("RPC fail");
      return [{ args: ["0xAuthor", 1n] }];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("refreshFeed returns empty when no minted events are found up to block 0", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 500_000) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = "0xabc";

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") return [];
      return [];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  it("sets status when loading comments fails", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") return [{ args: ["0xAuthor", 1n] }];
      throw new Error("comments fail");
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    await act(async () => {
      screen.getByText("comments").click();
    });

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("comments fail")));
  });

  it("loadPostsByTokenIds ignores items when contract calls fail", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    readContract.exists.mockImplementation(async (id: bigint) => id === 2n);
    readContract.tokenURI.mockImplementation(async (id: bigint) => {
      if (id === 2n) throw new Error("tokenURI fail");
      return "ipfs://meta";
    });

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("dedupes refreshFeed while a refresh is in flight", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };

    let resolveMinted: ((v: any[]) => void) | null = null;
    const mintedPromise = new Promise<any[]>((resolve) => {
      resolveMinted = resolve;
    });

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") return mintedPromise;
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // While the initial refresh is in-flight, try refreshing again.
    await act(async () => {
      screen.getByText("refresh").click();
    });

    expect(readContract.queryFilter).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMinted?.([{ args: ["0xAuthor", 1n] }]);
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("refreshFeed drops posts when token reads fail for a minted event", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") return [{ args: ["0xAuthor", 1n] }];
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });
    readContract.exists.mockImplementation(async () => true);
    readContract.tokenURI.mockImplementation(async () => {
      throw new Error("token read fail");
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  it("refreshFeed reports and rethrows when log fetching cannot shrink further", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 500_000) };

    readContract.queryFilter.mockImplementation(async () => {
      throw new Error("RPC fail");
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // The initial refresh will fail; wait until status gets set.
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("RPC fail")));
  });

  it("loadCommentsForPost returns early when provider is missing", async () => {
    walletState.provider = null;
    readContract.queryFilter.mockClear();

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await act(async () => {
      screen.getByText("comments").click();
    });

    expect(readContract.queryFilter).not.toHaveBeenCalled();
  });

  it("loadCommentsForPost skips logs when parseLog returns null", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    (socialInterface.parseLog as any).mockReturnValueOnce(null);

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    await act(async () => {
      screen.getByText("comments").click();
    });

    await waitFor(() => expect(screen.getByTestId("comments")).toHaveTextContent("0"));
  });

  it("loadPostsByTokenIds returns early for empty input and for fully-existing ids", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    readContract.exists.mockClear();

    await act(async () => {
      screen.getByText("loadByIdsEmpty").click();
      screen.getByText("loadByIdsExisting").click();
    });

    // No new exists calls should be needed for empty or already-loaded ids.
    expect(readContract.exists).not.toHaveBeenCalled();
  });

  it("loadPostsByTokenIds drops ids that do not exist", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    readContract.exists.mockImplementation(async () => false);

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("loadPostsByTokenIds sets liked/reposted to undefined when wallet is disconnected", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletAddress = null;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // On mount it should still load minted posts; with no wallet address these are undefined.
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("liked0")).toHaveTextContent("undefined");
    expect(screen.getByTestId("reposted0")).toHaveTextContent("undefined");
  });

  it("loadPostsByTokenIds uses metadata fallbacks when metadata is missing", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    (fetchTokenMetadata as any).mockResolvedValueOnce(null);

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("title0")).toHaveTextContent("Token #1");
    expect(screen.getByTestId("body0")).toHaveTextContent("");
    expect(screen.getByTestId("image0")).toHaveTextContent("");
  });

  it("refreshFeed drops minted events missing tokenId args", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") return [{ args: ["0xAuthor"] }];
      return [];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  it("refreshFeed drops minted events when exists=false", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    readContract.exists.mockImplementation(async () => false);

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
  });

  it("sets status to Wallet connected when account changes to a value", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.walletAddress = null;

    const { rerender } = render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // initial effect
    await waitFor(() => expect(setStatus).toHaveBeenCalled());

    setStatus.mockClear();
    walletState.walletAddress = "0xabc";
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Wallet connected."));
  });

  it("throws when useFeed is used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useFeed();
      return null;
    }

    try {
      expect(() => render(<Bad />)).toThrow("useFeed must be used within <FeedProvider>");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("loadPostsByTokenIds returns early when provider is missing", async () => {
    walletState.provider = null;
    readContract.exists.mockClear();

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    expect(readContract.exists).not.toHaveBeenCalled();
  });

  it("loadPostsByTokenIds does not query like/share flags when wallet is disconnected", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletAddress = null;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    readContract.hasLiked.mockClear();
    readContract.hasShared.mockClear();
    readContract.exists.mockImplementation(async (id: bigint) => id === 2n);

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(readContract.hasLiked).not.toHaveBeenCalled();
    expect(readContract.hasShared).not.toHaveBeenCalled();
  });

  it("loadPostsByTokenIds uses token metadata fallbacks", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    readContract.exists.mockImplementation(async (id: bigint) => id === 2n);
    (fetchTokenMetadata as any).mockResolvedValueOnce(null);

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
  });

  it("refreshFeed returns early when provider is missing", async () => {
    walletState.provider = null;
    readContract.queryFilter.mockClear();

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await act(async () => {
      screen.getByText("refresh").click();
    });

    expect(readContract.queryFilter).not.toHaveBeenCalled();
  });
});
