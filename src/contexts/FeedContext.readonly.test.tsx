import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { getSocialContract } from "../contracts/socialPosts";

// Mock ethers JsonRpcProvider so no real network calls happen.
vi.mock("ethers", () => {
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
  }

  return {
    ethers: {
      JsonRpcProvider: FakeJsonRpcProvider
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
  beforeEach(() => {
    vi.unstubAllEnvs();
    setStatus.mockClear();

    walletState.provider = null;
    walletState.walletAddress = null;
    walletState.chainId = "0x1";
    walletState.walletEpoch = 0;

    readContract.queryFilter.mockClear();
    (getSocialContract as any).mockClear?.();
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
    vi.stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "");
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

  it("uses VITE_CONTRACT_ADDRESS as a fallback for local when VITE_CONTRACT_ADDRESS_LOCAL is unset", async () => {
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

    // Only local is configured, via legacy address.
    // IMPORTANT: FeedContext uses `VITE_CONTRACT_ADDRESS_LOCAL ?? VITE_CONTRACT_ADDRESS`.
    // `vi.stubEnv` sets string values; setting to `""`/`"undefined"` won't trigger `??`.
    // Delete the key so it becomes truly `undefined` and the fallback is exercised.
    const envAny = import.meta.env as any;
    const hadLocalAddr = Object.prototype.hasOwnProperty.call(envAny, "VITE_CONTRACT_ADDRESS_LOCAL");
    const oldLocalAddr = envAny.VITE_CONTRACT_ADDRESS_LOCAL;
    const oldLegacyAddr = envAny.VITE_CONTRACT_ADDRESS;
    const oldLocalRpc = envAny.VITE_LOCAL_RPC_URL;

    // Use the legacy single-network address for the local chain.
    envAny.VITE_CONTRACT_ADDRESS = "0x00000000000000000000000000000000000000aa";
    envAny.VITE_LOCAL_RPC_URL = "http://example.invalid";
    // Remove the local-specific key so `??` falls back.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete envAny.VITE_CONTRACT_ADDRESS_LOCAL;

    walletState.walletEpoch = 1;

    const { FeedProvider, useFeed } = await import("./FeedContext");

    function Consumer() {
      const feed = useFeed();
      return <div data-testid="count">{feed.posts.length}</div>;
    }

    try {
      render(
        <FeedProvider>
          <Consumer />
        </FeedProvider>
      );

      await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
      expect(getSocialContract).toHaveBeenCalledWith(
        "0x00000000000000000000000000000000000000aa",
        expect.anything()
      );
    } finally {
      envAny.VITE_CONTRACT_ADDRESS = oldLegacyAddr;
      envAny.VITE_LOCAL_RPC_URL = oldLocalRpc;
      if (hadLocalAddr) envAny.VITE_CONTRACT_ADDRESS_LOCAL = oldLocalAddr;
    }
  });

  it("uses VITE_CONTRACT_ADDRESS_LOCAL when it is set", async () => {
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

    vi.stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x00000000000000000000000000000000000000bb");
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
    vi.stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "");
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
      vi.stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "");
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
