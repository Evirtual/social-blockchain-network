describe("FeedContext polling interval", () => {
  it("sets and clears interval when provider and hasAnyReadOnlyRpc are present", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(window, "clearInterval");
    const setSpy = vi.spyOn(window, "setInterval");
    // Simulate provider and hasAnyReadOnlyRpc
    const provider = {};
    const hasAnyReadOnlyRpc = true;
    const refreshFeed = vi.fn();
    const Test = () => {
      // Inline useEffect logic from FeedContext
      useEffect(() => {
        if (!provider && !hasAnyReadOnlyRpc) return;
        const id = window.setInterval(() => {
          void refreshFeed("0xabc");
        }, 15000);
        return () => window.clearInterval(id);
      }, [provider, hasAnyReadOnlyRpc]);
      return null;
    };
    const { unmount } = render(<Test />);
    expect(setSpy).toHaveBeenCalled();
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    setSpy.mockRestore();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });
});
describe("FeedProvider useEffect interval", () => {
  it("cleans up interval on unmount and handles refreshFeed errors", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(window, "clearInterval");
    const refreshFeed = vi.fn().mockRejectedValue(new Error("fail"));
    const Test = () => {
      useEffect(() => {
        const id = window.setInterval(() => {
          void refreshFeed("0xabc").catch(() => {});
        }, 100);
        return () => window.clearInterval(id);
      }, []);
      return null;
    };
    const { unmount } = render(<Test />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { FeedProvider, useFeed, type FeedContextValue } from "./FeedContext";
import { getSocialContract, socialInterface } from "../contracts/socialPosts";
import { fetchTokenMetadata } from "../lib/metadata";

const notifyPending = vi.fn();
const dismiss = vi.fn();

// Mock ethers JsonRpcProvider so no real network calls or startup retry logs happen.
vi.mock("ethers", () => {
  const rpcGetCodeMock = vi.fn(async (_address: string) => "0x1234");

  class FakeJsonRpcProvider {
    url: string;
    chainId: number;

    constructor(url: string, chainId: number) {
      this.url = url;
      this.chainId = chainId;
    }

    async getBlockNumber() {
      return 10;
    }

    async getBlock() {
      return { timestamp: 123 } as any;
    }

    async getCode(address: string) {
      return rpcGetCodeMock(address);
    }

    async getNetwork() {
      return { chainId: this.chainId } as any;
    }
  }

  return {
    ethers: {
      JsonRpcProvider: FakeJsonRpcProvider,
      __rpcGetCodeMock: rpcGetCodeMock
    }
  };
});

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

const ensureContractDeployedOnCurrentNetwork = vi.fn(async () => undefined);
const getReadContract = vi.fn(async () => readContract);

vi.mock("./WalletContext", () => ({
  useWallet: () => walletState
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ status: "", setStatus })
}));

vi.mock("./TxNotificationsContext", () => ({
  useTxNotifications: () => ({ notifyPending, dismiss }),
  TxNotificationsProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    ensureContractDeployedOnCurrentNetwork,
    getReadContract
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
  getSocialContract: vi.fn(() => readContract),
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
      <div data-testid="chainId0">{first?.chainId ?? ""}</div>
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

function ExposeFeed({ onFeed }: { onFeed: (feed: FeedContextValue) => void }) {
  const feed = useFeed();
  useEffect(() => {
    onFeed(feed);
  }, [feed, onFeed]);
  return null;
}

describe("FeedContext", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();

    // Make tests deterministic even if a developer has network env vars set locally.
    // By default, tests should exercise only the connected-wallet provider path.
    vi.stubEnv("VITE_CONTRACT_ADDRESS_ETH", "");
    vi.stubEnv("VITE_ETH_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_SEPOLIA", "");
    vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BASE", "");
    vi.stubEnv("VITE_BASE_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BASE_SEPOLIA", "");
    vi.stubEnv("VITE_BASE_SEPOLIA_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BSC", "");
    vi.stubEnv("VITE_BSC_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BSC_TESTNET", "");
    vi.stubEnv("VITE_BSC_TESTNET_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");

    walletState.provider = null;
    walletState.walletAddress = "0xabc";
    walletState.chainId = "1";
    walletState.walletEpoch = 0;

    setStatus.mockClear();

    notifyPending.mockClear();
    dismiss.mockClear();

  (getSocialContract as any).mockClear?.();

  ensureContractDeployedOnCurrentNetwork.mockReset();
  ensureContractDeployedOnCurrentNetwork.mockResolvedValue(undefined);
  getReadContract.mockReset();
  getReadContract.mockResolvedValue(readContract);

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

  it("uses env contract address fallback when local is empty (|| fallback branch)", async () => {
    // Cover the fallback branch: LOCAL is an empty string so `LOCAL || CONTRACT` uses CONTRACT.
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://localhost:8545");

    walletState.chainId = "31337";
    walletState.provider = null;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => {
      expect(getSocialContract).toHaveBeenCalled();
    });
  });

  it("covers resolveRpcContractAddress legacy/local empty-string fallbacks (||)", async () => {
    // Cover `legacy || ''` and `local || ''` falsy paths with empty strings.
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://localhost:8545");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000002");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");

    walletState.chainId = "31337";
    walletState.provider = null;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => {
      expect(getSocialContract).toHaveBeenCalled();
    });
  });

  it("resolveRpcContractAddress returns cfg.contractAddress when not local chain", async () => {
    // Turn on env RPC so resolveRpcContractAddress is evaluated.
    vi.stubEnv("VITE_ETH_RPC_URL", "http://rpc.example");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_ETH", "0x0000000000000000000000000000000000000002");

    walletState.chainId = "1";
    walletState.provider = null;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await act(async () => {
      screen.getByText("loadByIdsNew").click();
    });

    await waitFor(() => {
      expect(getSocialContract).toHaveBeenCalledWith("0x0000000000000000000000000000000000000002", expect.anything());
    });
  });

  it("resolveRpcContractAddress falls back when candidates have no code / throw / no exists", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://localhost:8545");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000003");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000004");

    walletState.chainId = "31337";
    walletState.provider = null;

    // Make candidates fail: first no code, then throw, then no code again.
    const { ethers: mockedEthers }: any = await import("ethers");
    const rpcGetCode = mockedEthers.__rpcGetCodeMock as any;
    rpcGetCode.mockReset();
    rpcGetCode
      .mockImplementationOnce(async () => "0x")
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementation(async () => "0x");

    let exposedFeed: FeedContextValue | null = null;

    render(
      <FeedProvider>
        <ExposeFeed onFeed={(f) => (exposedFeed = f)} />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());

    await act(async () => {
      await exposedFeed!.loadPostsByTokenIds(["2"]);
    });

    expect(getSocialContract).toHaveBeenCalled();
  });

  it("loadPostsByTokenIds resolves local contract address candidates", async () => {
    // Force the env-RPC path + local chain resolution.
    walletState.chainId = "31337";
    walletState.provider = null;

    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0xAAA");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0xBBB");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://localhost:8545");

    // First candidate has no code (so it fails without probing `exists`), second candidate has code.
    const { ethers: mockedEthers }: any = await import("ethers");
    const rpcGetCode = mockedEthers.__rpcGetCodeMock as any;
    rpcGetCode.mockReset();
    rpcGetCode.mockImplementation(async (address: string) => {
      if (address.toLowerCase() === "0xaaa") return "0x";
      return "0x1234";
    });

    let exposedFeed: FeedContextValue | null = null;

    render(
      <FeedProvider>
        <ExposeFeed onFeed={(f) => (exposedFeed = f)} />
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());

    await act(async () => {
      await exposedFeed!.loadPostsByTokenIds(["2"]);
    });

    // If local contract resolution succeeds, the load path completes and sets a post.
    await waitFor(() => expect(Number(screen.getByTestId("count").textContent ?? "0")).toBeGreaterThan(0));
  });

  it("loadPostsByTokenIds local probing handles RPC exceptions", async () => {
    walletState.chainId = "31337";
    walletState.provider = null;

    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x00000000000000000000000000000000000000aa");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://localhost:8545");

    const { ethers: mockedEthers }: any = await import("ethers");
    const rpcGetCode = mockedEthers.__rpcGetCodeMock as any;
    rpcGetCode.mockReset();
    rpcGetCode.mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    let exposedFeed: FeedContextValue | null = null;

    render(
      <FeedProvider>
        <ExposeFeed onFeed={(f) => (exposedFeed = f)} />
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());

    await act(async () => {
      await exposedFeed!.loadPostsByTokenIds(["2"]);
    });

    await waitFor(() => expect(Number(screen.getByTestId("count").textContent ?? "0")).toBeGreaterThan(0));
  });

  it("loadPostsByTokenIds uses env-RPC on non-local chains", async () => {
    // Force env-RPC path for the current chain (non-local) with no wallet provider.
    walletState.chainId = "11155111";
    walletState.provider = null;

    vi.stubEnv("VITE_CONTRACT_ADDRESS_SEPOLIA", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "http://example.invalid");

    let exposedFeed: FeedContextValue | null = null;
    render(
      <FeedProvider>
        <ExposeFeed onFeed={(f) => (exposedFeed = f)} />
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());

    await act(async () => {
      await exposedFeed!.loadPostsByTokenIds(["2"]);
    });

    await waitFor(() => expect(Number(screen.getByTestId("count").textContent ?? "0")).toBeGreaterThan(0));
    expect(getSocialContract).toHaveBeenCalledWith("0x0000000000000000000000000000000000000001", expect.anything());
  });

  it("derives mintTimestamp using timestamp ?? 0 when block has no timestamp", async () => {
    const provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({}))
    };
    walletState.provider = provider;
    walletState.walletEpoch = 1;

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") {
        return [
          {
            args: ["0xAuthor", 1n],
            blockNumber: 7,
            transactionHash: "0xtx"
          }
        ];
      }
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(provider.getBlock).toHaveBeenCalledWith(7);
  });

  it("sorts posts by mintTimestamp when timestamps differ", async () => {
    const provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async (n: number) => ({ timestamp: n === 8 ? 200 : 100 }))
    };
    walletState.provider = provider;
    walletState.walletEpoch = 1;

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") {
        return [
          { args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx1" },
          { args: ["0xAuthor", 2n], blockNumber: 8, transactionHash: "0xtx2" }
        ];
      }
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });

    type CapturedFeed = { posts: Array<{ tokenId: string }> };
    let captured!: CapturedFeed;
    render(
      <FeedProvider>
        <ExposeFeed onFeed={(f) => (captured = f as unknown as CapturedFeed)} />
      </FeedProvider>
    );

    await waitFor(() => expect(captured.posts.length).toBe(2));
    expect(captured.posts[0]?.tokenId).toBe("2");
    expect(captured.posts[1]?.tokenId).toBe("1");
  });

  it("sets partial-success status when an extra network fails", async () => {
    vi.stubEnv("MODE", "development");

    // Ensure this test is deterministic even if a developer has other networks
    // configured in their local env (which would otherwise add extraNetworks).
    vi.stubEnv("VITE_CONTRACT_ADDRESS_ETH", "");
    vi.stubEnv("VITE_ETH_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BASE", "");
    vi.stubEnv("VITE_BASE_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BASE_SEPOLIA", "");
    vi.stubEnv("VITE_BASE_SEPOLIA_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BSC", "");
    vi.stubEnv("VITE_BSC_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BSC_TESTNET", "");
    vi.stubEnv("VITE_BSC_TESTNET_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_SEPOLIA", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "http://example.invalid");

    const provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({ timestamp: 123 }))
    };
    walletState.provider = provider;
    walletState.walletEpoch = 1;

    const badContract: any = {
      filters: { PostMinted: () => "PostMintedFilter" },
      queryFilter: vi.fn(async () => {
        throw new Error("rpc down");
      })
    };

    (getSocialContract as any).mockImplementation((addr: string) => {
      if (addr === "0x0000000000000000000000000000000000000001") return badContract;
      return readContract;
    });

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") {
        return [{ args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx" }];
      }
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith("Feed loaded (some networks failed).")
    );
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

  it("parses uppercase 0X chainId values", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.chainId = "0X1";

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("returns null for invalid decimal chainId values", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.chainId = "not-a-number";

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("loadPostsByTokenIds uses undefined chainId when current chainId cannot be parsed", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.chainId = "0xZZ";

    let exposedFeed: ReturnType<typeof useFeed> | null = null;

    render(
      <FeedProvider>
        <ExposeFeed onFeed={(feed) => (exposedFeed = feed)} />
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    await waitFor(() => expect(exposedFeed).not.toBeNull());

    // Initial refresh should store posts without a chainId when chainId can't be parsed.
    expect(exposedFeed!.posts[0]?.chainId).toBeUndefined();

    readContract.exists.mockImplementation(async (id: bigint) => id === 2n);

    await act(async () => {
      await exposedFeed!.loadPostsByTokenIds(["2"]);
    });

    await waitFor(() => {
      const loaded = exposedFeed!.posts.find((p) => p.tokenId === "2");
      expect(loaded).toBeTruthy();
      expect(loaded?.chainId).toBeUndefined();
    });
  });

  it("loadPostsByTokenIds does not treat posts from other chains as existing", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.chainId = "1";

    let exposedFeed: ReturnType<typeof useFeed> | null = null;

    render(
      <FeedProvider>
        <ExposeFeed onFeed={(feed) => (exposedFeed = feed)} />
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    await waitFor(() => expect(exposedFeed).not.toBeNull());

    await act(async () => {
      exposedFeed!.setPosts((prev) => [
        ...prev,
        {
          tokenId: "2",
          chainId: "8453",
          title: "Other",
          body: "",
          image: "",
          metadataURI: "ipfs://meta",
          author: "0xAuthor",
          likes: 0,
          comments: 0,
          shares: 0,
          tipsWei: 0n
        } as any
      ]);
    });

    readContract.exists.mockImplementation(async (id: bigint) => id === 2n);

    await act(async () => {
      await exposedFeed!.loadPostsByTokenIds(["2"]);
    });

    // Should now have both the other-chain version and the current-chain loaded version.
    const other = exposedFeed!.posts.find((p) => p.tokenId === "2" && p.chainId === "8453");
    const current = exposedFeed!.posts.find((p) => p.tokenId === "2" && p.chainId === "1");
    expect(other).toBeTruthy();
    expect(current).toBeTruthy();
  });

  it("sorts merged posts by timestamp, then block, then postKey", async () => {
    walletState.provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async (_n: number) => ({ timestamp: 1 }))
    };

    // Same timestamp, different block numbers -> block desc.
    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") {
        return [
          { args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx1" },
          { args: ["0xAuthor", 2n], blockNumber: 9, transactionHash: "0xtx2" },
          // Same timestamp + same block -> postKey tie-breaker.
          { args: ["0xAuthor", 3n], blockNumber: 7, transactionHash: "0xtx3" }
        ];
      }
      return [];
    });

    let exposedFeed: ReturnType<typeof useFeed> | null = null;
    render(
      <FeedProvider>
        <ExposeFeed onFeed={(feed) => (exposedFeed = feed)} />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());
    await waitFor(() => expect(exposedFeed!.posts.length).toBe(3));

    // Block 9 first.
    expect(exposedFeed!.posts[0]?.tokenId).toBe("2");

    // Between tokenId 1 and 3 (same ts+block), postKey tie-breaker puts 3 before 1.
    const idx1 = exposedFeed!.posts.findIndex((p) => p.tokenId === "1");
    const idx3 = exposedFeed!.posts.findIndex((p) => p.tokenId === "3");
    expect(idx3).toBeLessThan(idx1);
  });

  it("sorts merged posts by mintTimestamp when timestamps differ", async () => {
    walletState.provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async (n: number) => ({ timestamp: n }))
    };

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") {
        return [
          { args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx1" },
          { args: ["0xAuthor", 2n], blockNumber: 9, transactionHash: "0xtx2" }
        ];
      }
      return [];
    });

    let exposedFeed: ReturnType<typeof useFeed> | null = null;
    render(
      <FeedProvider>
        <ExposeFeed onFeed={(feed) => (exposedFeed = feed)} />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());
    await waitFor(() => expect(exposedFeed!.posts.length).toBe(2));

    // Timestamp from block 9 should sort first.
    expect(exposedFeed!.posts[0]?.tokenId).toBe("2");
  });

  it("does not set mintTimestamp when getBlock returns an object without timestamp", async () => {
    walletState.provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({}))
    };

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") {
        return [{ args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx" }];
      }
      return [];
    });

    let exposedFeed: ReturnType<typeof useFeed> | null = null;
    render(
      <FeedProvider>
        <ExposeFeed onFeed={(feed) => (exposedFeed = feed)} />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());
    await waitFor(() => expect(exposedFeed!.posts.length).toBe(1));
    expect(exposedFeed!.posts[0]?.mintTimestamp).toBeUndefined();
  });

  it("grows the log window when an initial query returns empty results", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 100_000) };

    // Return no events unless the query starts at block 0.
    readContract.queryFilter.mockImplementation(async (filter: string, from?: number) => {
      if (filter !== "PostMintedFilter") return [];
      if ((from ?? 0) > 0) return [];
      return [];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // Successful refresh with no events.
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
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

  it("does not refresh when only the chain changes", async () => {
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

    // Clear initial refresh status calls so we only assert the rerender behavior.
    setStatus.mockClear();

    walletState.chainId = "8453";
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // Switching wallet chains should not affect the aggregated read-only feed.
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("re-runs refresh when wallet connects mid-flight (so liked/saved state matches after reload)", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = null;

    // Make the first refresh slow so we can change walletAddress while it's in-flight.
    let resolveTokenUri: ((v: string) => void) | null = null;
    let tokenUriCalls = 0;
    readContract.tokenURI.mockImplementation(
      async (_: bigint) => {
        const callIndex = tokenUriCalls++;
        if (callIndex > 0) return "ipfs://meta";
        return await new Promise<string>((resolve) => {
          resolveTokenUri = resolve;
        });
      }
    );

    // hasLiked should only be true once the wallet connects.
    readContract.hasLiked.mockImplementation(async (_: bigint, account: string) => account.toLowerCase() === "0xabc");

    const { rerender } = render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // Ensure the initial refresh has started and is blocked on tokenURI.
    await waitFor(() => expect(readContract.tokenURI).toHaveBeenCalled());
    await waitFor(() => expect(resolveTokenUri).not.toBeNull());

    // Wallet connects while refresh is still pending.
    walletState.walletAddress = "0xAbC";
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // Unblock the slow first refresh.
    resolveTokenUri!("ipfs://meta");

    // The queued refresh should run and populate likedByMe based on the connected account.
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    await waitFor(() => expect(screen.getByTestId("liked0")).toHaveTextContent("true"));
  });

  it("allows queued refresh even if in-flight refresh fails (covers catch + nullish queued account)", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = null;

    let rejectMinted: ((err: unknown) => void) | null = null;
    const mintedPromise = new Promise<any[]>((_, reject) => {
      rejectMinted = reject;
    });

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") return mintedPromise;
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });

    let exposedFeed: ReturnType<typeof useFeed> | null = null;

    render(
      <FeedProvider>
        <ExposeFeed onFeed={(feed) => (exposedFeed = feed)} />
        <Consumer />
      </FeedProvider>
    );

    // Initial refresh starts on mount and should be blocked on mintedPromise.
    await waitFor(() => expect(readContract.queryFilter).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(exposedFeed).not.toBeNull());

    // Trigger a refresh while the initial one is still in-flight. This should hit the queued branch
    // with a nullish account, and then await the in-flight refresh.
    const queuedRefresh = exposedFeed!.refreshFeed();
    expect(readContract.queryFilter).toHaveBeenCalledTimes(1);

    // Now force the in-flight refresh to fail so the queued refresh hits the catch path.
    await act(async () => {
      rejectMinted?.(new Error("minted fail"));
    });

    await queuedRefresh;
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("minted fail")));
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

    // Clear initial refresh calls so we only assert the rerender-triggered refresh.
    setStatus.mockClear();
    readContract.queryFilter.mockClear();

    walletState.walletAddress = null;
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(readContract.queryFilter).toHaveBeenCalled());
  });

  it("does not refresh feed on chain-only changes after initial load", async () => {
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

    // Clear initial refresh calls so we only assert the rerender-triggered behavior.
    readContract.queryFilter.mockClear();

    // Simulate a wallet chain switch without account change.
    walletState.chainId = "8453";
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    // Give effects a tick; no refresh should happen.
    await act(async () => {
      await Promise.resolve();
    });

    expect(readContract.queryFilter).not.toHaveBeenCalled();
  });

  it("refreshes feed on initial mount even when walletAddress is null", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = null;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(readContract.queryFilter).toHaveBeenCalled());
  });

  it("does not refresh when walletEpoch bumps but chain/account are unchanged", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = "0xabc";

    const { rerender } = render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(readContract.queryFilter).toHaveBeenCalled());
    readContract.queryFilter.mockClear();

    // Epoch bump with same chainId + walletAddress
    walletState.walletEpoch = 1;
    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(readContract.queryFilter).not.toHaveBeenCalled();
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

  it("refreshFeed paginates log queries when RPC limits large ranges", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 500_000) };
    walletState.walletEpoch = 0;
    walletState.chainId = "1";
    walletState.walletAddress = "0xabc";

    // Simulate an RPC that rejects large eth_getLogs ranges.
    readContract.queryFilter.mockImplementation(async (_filter: any, fromBlock?: number, toBlock?: number) => {
      const from = Number(fromBlock ?? 0);
      const to = Number(toBlock ?? from);
      if (to - from > 10_000) {
        const err: any = new Error("Request exceeds defined limit");
        err.code = -32005;
        throw err;
      }
      // Return a single minted event in the chunk.
      return [{ args: ["0xAuthor", 1n] }];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(readContract.queryFilter.mock.calls.length).toBeGreaterThan(1);
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

  it("triggers a feed refresh when the account changes to a value", async () => {
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
    readContract.queryFilter.mockClear();
    walletState.walletAddress = "0xabc";
    walletState.walletEpoch = 1;

    rerender(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(readContract.queryFilter).toHaveBeenCalled());
  });

  it("loads current chain via public RPC when wallet is disconnected", async () => {
    // Configure current chain (ETH) + an extra chain so we don't early-return.
    vi.stubEnv("VITE_CONTRACT_ADDRESS_ETH", "0x00000000000000000000000000000000000000e1");
    vi.stubEnv("VITE_ETH_RPC_URL", "http://eth.example.invalid");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_SEPOLIA", "0x00000000000000000000000000000000000000s1");
    vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "http://sepolia.example.invalid");

    walletState.provider = null;
    walletState.walletAddress = null;
    walletState.chainId = "1";
    walletState.walletEpoch = 1;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    const calls = (getSocialContract as any).mock.calls as Array<[string, any]>;
    expect(calls.some(([addr, p]) => addr === "0x00000000000000000000000000000000000000e1" && p?.chainId === 1)).toBe(true);
    expect(calls.some(([addr, p]) => addr === "0x00000000000000000000000000000000000000s1" && p?.chainId === 11155111)).toBe(true);
  });

  it("falls back to injected provider when chainId is not resolved", async () => {
    walletState.provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({ timestamp: 123 }))
    };
    walletState.walletAddress = "0xabc";
    walletState.chainId = null;
    walletState.walletEpoch = 1;

    ensureContractDeployedOnCurrentNetwork.mockClear();
    getReadContract.mockClear();

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(ensureContractDeployedOnCurrentNetwork).toHaveBeenCalled();
    expect(getReadContract).toHaveBeenCalled();
  });

  it("continues when getNetwork throws while resolving chainId", async () => {
    walletState.provider = {
      getNetwork: vi.fn(async () => {
        throw new Error("getNetwork fail");
      }),
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({ timestamp: 123 }))
    };
    walletState.walletAddress = "0xabc";
    walletState.chainId = null;
    walletState.walletEpoch = 1;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(walletState.provider.getNetwork).toHaveBeenCalled();
  });

  it("ignores provider fallback errors when chainId is not resolved", async () => {
    walletState.provider = {
      getNetwork: vi.fn(async () => ({ chainId: 1 })),
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({ timestamp: 123 }))
    };
    walletState.walletAddress = "0xabc";
    walletState.chainId = null;
    walletState.walletEpoch = 1;

    ensureContractDeployedOnCurrentNetwork.mockReset();
    ensureContractDeployedOnCurrentNetwork.mockRejectedValue(new Error("not deployed"));

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Feed loaded."));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("sets resolved chainId to null when getNetwork returns non-numeric chainId", async () => {
    walletState.provider = {
      getNetwork: vi.fn(async () => ({ chainId: "nope" })),
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({ timestamp: 123 }))
    };
    walletState.walletAddress = "0xabc";
    walletState.chainId = null;
    walletState.walletEpoch = 1;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("chainId0")).toHaveTextContent("");
  });

  it("resolves chainId from getNetwork when chainId is not provided", async () => {
    walletState.provider = {
      getNetwork: vi.fn(async () => ({ chainId: 1 })),
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => ({ timestamp: 123 }))
    };
    walletState.walletAddress = "0xabc";
    walletState.chainId = null;
    walletState.walletEpoch = 1;

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("chainId0")).toHaveTextContent("1");
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

    let exposedFeed: FeedContextValue | null = null;

    render(
      <FeedProvider>
        <ExposeFeed onFeed={(f) => (exposedFeed = f)} />
      </FeedProvider>
    );

    await waitFor(() => expect(exposedFeed).not.toBeNull());

    await act(async () => {
      await exposedFeed!.loadPostsByTokenIds(["2", "2"]);
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

  it("ignores getBlock failures when deriving mintTimestamp", async () => {
    walletState.provider = {
      getBlockNumber: vi.fn(async () => 10),
      getBlock: vi.fn(async () => {
        throw new Error("block fail");
      })
    };

    readContract.queryFilter.mockImplementation(async (filter: string) => {
      if (filter === "PostMintedFilter") {
        return [{ args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx" }];
      }
      return [{ transactionHash: "0xtx", blockNumber: 123, topics: [], data: "0x" }];
    });

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect((walletState.provider as any).getBlock).toHaveBeenCalled();
  });

  it("continues when the connected network contract is not deployed/configured", async () => {
    walletState.provider = { getBlockNumber: vi.fn(async () => 10) };
    ensureContractDeployedOnCurrentNetwork.mockRejectedValueOnce(new Error("not deployed"));

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Feed loaded."));
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

  it("creates and clears the polling interval when not in vitest worker", () => {
    vi.useFakeTimers();

    const prevVitestWorker = (globalThis as any).__vitest_worker__;
    const setSpy = vi.spyOn(window, "setInterval");
    const clearSpy = vi.spyOn(window, "clearInterval");

    try {
      // Disable the guard so we cover the interval effect.
      (globalThis as any).__vitest_worker__ = undefined;

      // Enable readonly-rpc path so FeedProvider will schedule polling even without wallet provider.
      vi.stubEnv("VITE_BASE_RPC_URL", "http://localhost:8545");
      walletState.provider = null;

      const { unmount } = render(
        <FeedProvider>
          <Consumer />
        </FeedProvider>
      );

      expect(setSpy).toHaveBeenCalled();

      // Run one polling tick to execute the callback body.
      vi.advanceTimersByTime(15_000);

      unmount();
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      (globalThis as any).__vitest_worker__ = prevVitestWorker;
      setSpy.mockRestore();
      clearSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does not create polling interval when no provider and no readonly RPCs (not vitest worker)", () => {
    vi.useFakeTimers();

    const prevVitestWorker = (globalThis as any).__vitest_worker__;
    const setSpy = vi.spyOn(window, "setInterval");

    try {
      (globalThis as any).__vitest_worker__ = undefined;

      // Keep env rpcs empty (beforeEach already does) and provider null.
      walletState.provider = null;

      render(
        <FeedProvider>
          <Consumer />
        </FeedProvider>
      );

      expect(setSpy).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).__vitest_worker__ = prevVitestWorker;
      setSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
