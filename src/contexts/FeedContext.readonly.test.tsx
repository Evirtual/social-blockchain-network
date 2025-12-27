import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { getSocialContract } from "../contracts/socialPosts";

const notifyPending = vi.fn();
const dismiss = vi.fn();

// Mock ethers JsonRpcProvider so no real network calls happen.
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
  walletAddress: null,
  chainId: "0x1",
  walletEpoch: 0
};

const readContract: any = {
  filters: {
    PostMinted: () => "PostMintedFilter"
  },
  queryFilter: vi.fn(async (_filter: any, _from?: number, _to?: number) => [{ args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx" }]),
  exists: vi.fn(async () => true),
  tokenURI: vi.fn(async () => "ipfs://meta"),
  likesOf: vi.fn(async () => 0n),
  commentsOf: vi.fn(async () => 0n),
  sharesOf: vi.fn(async () => 0n),
  tipsOf: vi.fn(async () => 0n),
  hasLiked: vi.fn(async () => false),
  hasShared: vi.fn(async () => false)
};

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
    ensureContractDeployedOnCurrentNetwork: vi.fn(async () => undefined),
    getReadContract: vi.fn(async () => readContract)
  })
}));

vi.mock("../contracts/socialPosts", () => ({
  getSocialContract: vi.fn((_addr: string, _provider: any) => readContract),
  socialInterface: { parseLog: vi.fn() }
}));

vi.mock("../lib/metadata", () => ({
  fetchTokenMetadata: vi.fn(async () => ({ name: "Hello", description: "World", image: "ipfs://img" }))
}));

describe("FeedContext (read-only networks)", () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    setStatus.mockClear();

    notifyPending.mockClear();
    dismiss.mockClear();

    walletState.provider = null;
    walletState.walletAddress = null;
    walletState.chainId = "0x1";
    walletState.walletEpoch = 0;

    readContract.queryFilter.mockClear();
    (getSocialContract as any).mockClear?.();

    // Reset rpc getCode behavior for tests that cover local probing.
    const { ethers } = await import("ethers");
    (ethers as any).__rpcGetCodeMock?.mockReset?.();
    (ethers as any).__rpcGetCodeMock?.mockResolvedValue?.("0x1234");
  });

  it("loads via read-only RPC when wallet is disconnected", async () => {
    // Enable read-only RPCs even under vitest by overriding MODE.
    vi.stubEnv("MODE", "development");

    // Make the configured networks deterministic for this test.
    // Blank out any other networks that may exist from local .env files.
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
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "");

    vi.stubEnv("VITE_CONTRACT_ADDRESS_SEPOLIA", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "http://example.invalid");

    // Trigger the effect by bumping walletEpoch.
    walletState.walletEpoch = 1;

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(readContract.queryFilter).toHaveBeenCalled();
  });

  it("does not configure local read-only network when VITE_CONTRACT_ADDRESS is unset", async () => {
    vi.stubEnv("MODE", "development");

    // Blank out other networks.
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

    // With only VITE_CONTRACT_ADDRESS supported, leaving it unset means local is not configured.
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://example.invalid");

    walletState.walletEpoch = 1;

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
    expect(getSocialContract).not.toHaveBeenCalled();
  });

  it("loads local via read-only RPC when MODE is development", async () => {
    vi.stubEnv("MODE", "development");

    // Blank out other networks.
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

    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x00000000000000000000000000000000000000aa");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://example.invalid");

    // Trigger the effect by bumping walletEpoch.
    walletState.walletEpoch = 1;

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(readContract.queryFilter).toHaveBeenCalled();
  });

  it("uses VITE_CONTRACT_ADDRESS when it is set", async () => {
    vi.stubEnv("MODE", "development");

    // Blank out other networks.
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

    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x00000000000000000000000000000000000000bb");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://example.invalid");

    walletState.walletEpoch = 1;

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(getSocialContract).toHaveBeenCalledWith(
      "0x00000000000000000000000000000000000000bb",
      expect.anything()
    );
  });

  it("local probing falls back when candidates have no code", async () => {
    vi.stubEnv("MODE", "development");

    // Make the configured networks deterministic.
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

    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x00000000000000000000000000000000000000aa");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://local.example.invalid");

    walletState.walletEpoch = 1;
    walletState.chainId = "0x1";

    const { ethers } = await import("ethers");
    (ethers as any).__rpcGetCodeMock.mockResolvedValue("0x");

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

    // It should attempt a code lookup for the configured local address.
    expect((ethers as any).__rpcGetCodeMock).toHaveBeenCalledWith("0x00000000000000000000000000000000000000aa");
    // Since no candidate had code, it falls back to cfg.contractAddress (local env addr).
    expect(getSocialContract).toHaveBeenCalledWith("0x00000000000000000000000000000000000000aa", expect.anything());
  });

  it("local probing skips failing candidate and uses the first that looks deployed", async () => {
    vi.stubEnv("MODE", "development");

    // Make the configured networks deterministic.
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

    vi.stubEnv("VITE_CONTRACT_ADDRESS", "0x00000000000000000000000000000000000000aa");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "http://local.example.invalid");

    const envAny = import.meta.env as any;
    const oldLegacy = envAny.VITE_CONTRACT_ADDRESS;
    envAny.VITE_CONTRACT_ADDRESS = "0x00000000000000000000000000000000000000bb";

    walletState.walletEpoch = 1;
    walletState.chainId = "0x1";

    const { ethers } = await import("ethers");
    (ethers as any).__rpcGetCodeMock
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async () => "0x1234");

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    try {
      await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));

      // The legacy candidate should be selected (first local candidate threw).
      expect(getSocialContract).toHaveBeenCalledWith(
        "0x00000000000000000000000000000000000000bb",
        expect.anything()
      );
      expect(readContract.exists).toHaveBeenCalled();
    } finally {
      envAny.VITE_CONTRACT_ADDRESS = oldLegacy;
    }
  });

  it("sets partial-success status when some read-only networks fail", async () => {
    vi.stubEnv("MODE", "development");

    // Configure two read-only networks.
    vi.stubEnv("VITE_CONTRACT_ADDRESS_SEPOLIA", "0x0000000000000000000000000000000000000001");
    vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "http://example.invalid/a");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BASE_SEPOLIA", "0x0000000000000000000000000000000000000002");
    vi.stubEnv("VITE_BASE_SEPOLIA_RPC_URL", "http://example.invalid/b");

    // Blank out other networks.
    vi.stubEnv("VITE_CONTRACT_ADDRESS_ETH", "");
    vi.stubEnv("VITE_ETH_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BASE", "");
    vi.stubEnv("VITE_BASE_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BSC", "");
    vi.stubEnv("VITE_BSC_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS_BSC_TESTNET", "");
    vi.stubEnv("VITE_BSC_TESTNET_RPC_URL", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "");

    const goodContract: any = {
      filters: { PostMinted: () => "PostMintedFilter" },
      queryFilter: vi.fn(async () => [{ args: ["0xAuthor", 1n], blockNumber: 7, transactionHash: "0xtx" }]),
      exists: vi.fn(async () => true),
      tokenURI: vi.fn(async () => "ipfs://meta"),
      likesOf: vi.fn(async () => 0n),
      commentsOf: vi.fn(async () => 0n),
      sharesOf: vi.fn(async () => 0n),
      tipsOf: vi.fn(async () => 0n),
      hasLiked: vi.fn(async () => false),
      hasShared: vi.fn(async () => false)
    };

    const badContract: any = {
      filters: { PostMinted: () => "PostMintedFilter" },
      queryFilter: vi.fn(async () => {
        throw new Error("rpc down");
      })
    };

    (getSocialContract as any).mockImplementation((addr: string) => {
      if (addr === "0x0000000000000000000000000000000000000001") return goodContract;
      if (addr === "0x0000000000000000000000000000000000000002") return badContract;
      return goodContract;
    });

    walletState.walletEpoch = 1;

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    render(
      <FeedProvider>
        <Consumer />
      </FeedProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Feed loaded (some networks failed)."));
  });

  it("treats missing env.MODE as non-test env", async () => {
    const envAny = import.meta.env as any;
    const hadMode = Object.prototype.hasOwnProperty.call(envAny, "MODE");
    const oldMode = envAny.MODE;

    // Delete MODE so `MODE ?? ""` takes the fallback path.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete envAny.MODE;

    try {
      // Minimal read-only config.
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
      vi.stubEnv("VITE_CONTRACT_ADDRESS", "");
      vi.stubEnv("VITE_LOCAL_RPC_URL", "");

      vi.stubEnv("VITE_CONTRACT_ADDRESS_SEPOLIA", "0x0000000000000000000000000000000000000001");
      vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "http://example.invalid");

      walletState.walletEpoch = 1;

      const { FeedProvider, useFeed } = await import("./FeedContext");

      function Consumer() {
        const feed = useFeed();
        return <div data-testid="count">{feed.posts.length}</div>;
      }

      render(
        <FeedProvider>
          <Consumer />
        </FeedProvider>
      );

      await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    } finally {
      if (hadMode) envAny.MODE = oldMode;
    }
  });
});
