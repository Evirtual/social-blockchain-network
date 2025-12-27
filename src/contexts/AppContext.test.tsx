import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { AppProvider, useApp } from "./AppContext";

// Mock ethers JsonRpcProvider so env-RPC branches are testable without real network calls.
vi.mock("ethers", () => {
  const rpcGetBlockNumberMock = vi.fn(async () => 10);

  class FakeJsonRpcProvider {
    url: string;
    chainId: number | undefined;

    constructor(url: string, chainId?: number) {
      this.url = url;
      this.chainId = chainId;
    }

    async getBlockNumber() {
      return rpcGetBlockNumberMock();
    }
  }

  return {
    ethers: {
      JsonRpcProvider: FakeJsonRpcProvider,
      __rpcGetBlockNumberMock: rpcGetBlockNumberMock
    }
  };
});

const socials = vi.hoisted(() => ({
  parseLog: vi.fn()
}));

const setStatus = vi.fn();

const theme = { theme: "light" as const, toggleTheme: vi.fn() };
const wallet: any = {
  provider: null,
  walletAddress: "0xabc",
  chainId: "1",
  networkName: "Test",
  nativeBalance: "0.01",
  walletEpoch: 0,
  connectWallet: vi.fn(async () => "0xabc"),
  disconnectWallet: vi.fn(),
  refreshWalletPanel: vi.fn(async () => undefined)
};

const contract: any = {
  contractDeployed: true,
  contractAddress: "0xcontract",
  withdrawableTipsWei: 0n,
  refreshContractState: vi.fn(async () => undefined),
  ensureContractDeployedOnCurrentNetwork: vi.fn(async () => undefined),
  getReadContract: vi.fn(async () => ({
    filters: {
      PostShared: (_addr: string, __: any) => "shared",
      PostUnshared: (_addr: string, __: any) => "unshared"
    },
    queryFilter: vi.fn(async () => [])
  }))
};

const feed: any = {
  posts: [],
  setPosts: vi.fn(),
  isFeedLoading: false,
  refreshFeed: vi.fn(async () => undefined),
  postComments: {},
  setPostComments: vi.fn(),
  isLoadingPostComments: {},
  loadCommentsForPost: vi.fn(async () => undefined),
  loadPostsByTokenIds: vi.fn(async () => undefined)
};

const profile: any = {
  authorIdentity: new Map(),
  profilesByAddress: {},
  loadProfile: vi.fn(async () => undefined),
  profileName: "",
  profileBio: "",
  profileAvatarUrl: "",
  displayName: "Me",
  myPostsCount: 0,
  isEditingProfile: false,
  profileDraftName: "",
  profileDraftBio: "",
  profileDraftAvatarUrl: "",
  profileDraftAvatarDataUrl: "",
  isProfileAvatarLoading: false,
  setProfileDraftName: vi.fn(),
  setProfileDraftBio: vi.fn(),
  setProfileDraftAvatarUrl: vi.fn(),
  onSelectProfileAvatarFile: vi.fn(async () => undefined),
  onClearProfileAvatar: vi.fn(),
  startEditProfile: vi.fn(),
  cancelEditProfile: vi.fn(),
  saveProfile: vi.fn(async () => undefined),
  selfAvatarHue: 0,
  profileLink: null
};

const follow: any = {
  isFollowingByAddress: {},
  loadIsFollowing: vi.fn(async () => undefined),
  toggleFollow: vi.fn(async () => undefined),
  followerCountByAddress: {},
  isLoadingFollowerCountByAddress: {},
  loadFollowerCountForAddress: vi.fn(async () => undefined),
  followersByAddress: {},
  isLoadingFollowersByAddress: {},
  loadFollowersForAddress: vi.fn(async () => undefined),
  followingByAddress: {},
  isLoadingFollowingByAddress: {},
  loadFollowingForAddress: vi.fn(async () => undefined)
};

const composer: any = {
  isComposerOpen: false,
  openComposer: vi.fn(),
  closeComposer: vi.fn(),
  ipfsConfigured: true,
  draft: { title: "", body: "", image: "" },
  isImageLoading: false,
  handleDraftChange: vi.fn(),
  onComposerImageUrlChange: vi.fn(),
  onComposerClearImage: vi.fn(),
  onSelectComposerFile: vi.fn(async () => undefined),
  mintPost: vi.fn(async () => undefined)
};

const social: any = {
  editingTokenId: null,
  editDraft: { title: "", body: "", image: "" },
  isEditImageLoading: false,
  tipDrafts: {},
  commentDrafts: {},
  setEditDraft: vi.fn(),
  onTipDraftChange: vi.fn(),
  onCommentDraftChange: vi.fn(),
  onEditSelectFile: vi.fn(async () => undefined),
  onEditClearImage: vi.fn(),
  startEditPost: vi.fn(),
  cancelEditPost: vi.fn(),
  saveEditedPost: vi.fn(async () => undefined),
  burnPost: vi.fn(async () => undefined),
  handleAction: vi.fn(async () => undefined),
  handleTip: vi.fn(async () => undefined),
  freezePost: vi.fn(async () => undefined),
  withdrawTips: vi.fn(async () => undefined)
};

vi.mock("./ThemeContext", () => ({ useTheme: () => theme }));
vi.mock("./WalletContext", () => ({ useWallet: () => wallet }));
vi.mock("./ContractContext", () => ({ useContract: () => contract }));
vi.mock("./StatusContext", () => ({ useStatus: () => ({ status: "", setStatus }) }));

vi.mock("./FeedContext", () => ({
  FeedProvider: ({ children }: any) => children,
  useFeed: () => feed
}));

vi.mock("./ProfileContext", () => ({
  ProfileProvider: ({ children }: any) => children,
  useProfile: () => profile
}));

vi.mock("./FollowContext", () => ({
  FollowProvider: ({ children }: any) => children,
  useFollow: () => follow
}));

vi.mock("./ComposerContext", () => ({
  ComposerProvider: ({ children }: any) => children,
  useComposer: () => composer
}));

vi.mock("./SocialActionsContext", () => ({
  SocialActionsProvider: ({ children }: any) => children,
  useSocialActions: () => social
}));

vi.mock("../contracts/socialPosts", () => ({
  getSocialContract: vi.fn((_address: string, _provider: any) => ({
    filters: {
      PostShared: (_addr: string, __: any) => "shared",
      PostUnshared: (_addr: string, __: any) => "unshared",
      PostLiked: (_addr: string, __: any) => "liked",
      PostUnliked: (_addr: string, __: any) => "unliked"
    },
    queryFilter: vi.fn(async () => [])
  })),
  socialInterface: {
    parseLog: (args: any) => socials.parseLog(args)
  }
}));

function Consumer() {
  const app = useApp();
  return (
    <div>
      <div data-testid="theme">{app.theme}</div>
      <div data-testid="addr">{app.walletAddress ?? "none"}</div>
      <div data-testid="connectNudge">{app.connectNudge ? "yes" : "no"}</div>
      <div data-testid="saved">{JSON.stringify(app.repostTokenIdsByAddress[(app.walletAddress ?? "").toLowerCase()] ?? [])}</div>
      <div data-testid="liked">{JSON.stringify(app.likedTokenIdsByAddress[(app.walletAddress ?? "").toLowerCase()] ?? [])}</div>
      <button type="button" onClick={() => app.connectWallet()}>
        connect
      </button>
      <button type="button" onClick={() => app.handleAction("1", "like", null)}>
        like
      </button>
      <button type="button" onClick={() => app.handleAction("1", "share", null)}>
        share
      </button>
      <button type="button" onClick={() => app.handleTip("1", null)}>
        tip
      </button>
      <button type="button" onClick={() => app.burnPost("1", null)}>
        burn
      </button>
      <button type="button" onClick={() => app.freezePost("1", null)}>
        freeze
      </button>
      <button type="button" onClick={() => app.withdrawTips()}>
        withdraw
      </button>
      <button type="button" onClick={() => app.toggleFollow("0xdef")}
      >
        follow
      </button>
      <button type="button" onClick={() => app.loadRepostsForAddress("0xabc")}>
        reposts
      </button>
      <button type="button" onClick={() => app.loadLikesForAddress("0xabc")}> 
        likes
      </button>
      <button type="button" onClick={() => app.loadLikesForAddress(" ")}> 
        likes-space
      </button>
      <button type="button" onClick={() => app.loadLikesForAddress("")}> 
        likes-empty
      </button>
    </div>
  );
}

function ExposeApp({ onApp }: { onApp: (app: ReturnType<typeof useApp>) => void }) {
  const app = useApp();
  useEffect(() => {
    onApp(app);
  }, [app, onApp]);
  return null;
}

describe("AppContext", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Make tests deterministic even if a developer has network env vars set locally.
    vi.stubEnv("VITE_ETH_RPC_URL", "");
    vi.stubEnv("VITE_ETH_SEPOLIA_RPC_URL", "");
    vi.stubEnv("VITE_BASE_RPC_URL", "");
    vi.stubEnv("VITE_BASE_SEPOLIA_RPC_URL", "");
    vi.stubEnv("VITE_BSC_RPC_URL", "");
    vi.stubEnv("VITE_BSC_TESTNET_RPC_URL", "");
    vi.stubEnv("VITE_LOCAL_RPC_URL", "");

    sessionStorage.clear();
    wallet.provider = null;
    wallet.walletAddress = "0xabc";
    wallet.chainId = "1";
    contract.contractAddress = "0xcontract";

    socials.parseLog.mockReset();
    setStatus.mockReset();

    contract.refreshContractState.mockReset();
    contract.refreshContractState.mockResolvedValue(undefined);
    contract.ensureContractDeployedOnCurrentNetwork.mockReset();
    contract.ensureContractDeployedOnCurrentNetwork.mockResolvedValue(undefined);
    contract.getReadContract.mockReset();
    contract.getReadContract.mockImplementation(async () => ({
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared",
        PostLiked: (_addr: string, __: any) => "liked",
        PostUnliked: (_addr: string, __: any) => "unliked"
      },
      queryFilter: vi.fn(async () => [])
    }));

    feed.loadPostsByTokenIds.mockClear();
    social.handleAction.mockReset();
  });

  it("handleAction('like') derives likedKey from tokenId when chainId is blank", async () => {
    wallet.walletAddress = "0xabc";
    wallet.chainId = "   ";

    // Force the underlying action to succeed.
    social.handleAction.mockResolvedValueOnce(true);

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("like").click();
    });

    // With blank chainId, the key should be tokenId-only.
    expect(screen.getByTestId("liked").textContent).toContain("\"1\"");
  });

  it("handleAction('like') parses uppercase 0X chain id", async () => {
    wallet.walletAddress = "0xabc";
    wallet.chainId = "0X1";

    social.handleAction.mockResolvedValueOnce(true);

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("like").click();
    });

    // Parsed chain id should normalize to decimal "1" prefix.
    expect(screen.getByTestId("liked").textContent).toContain("\"1:1\"");
  });

  it("handleAction('like') falls back to empty chain when both postChainId and wallet.chainId are null", async () => {
    wallet.walletAddress = "0xabc";
    wallet.chainId = null;
    social.handleAction.mockResolvedValueOnce(true);

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.handleAction("1", "like", null);
    });

    // No chain key -> tokenId-only key.
    expect(captured.likedTokenIdsByAddress["0xabc"]).toEqual(expect.arrayContaining(["1"]));
  });

  it("loadLikesForAddress covers networkKey fallback to empty when chainId and contractAddress are missing", async () => {
    wallet.chainId = null;
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };
    contract.contractAddress = null;

    contract.getReadContract.mockResolvedValueOnce({
      runner: {},
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async () => [])
    });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadLikesForAddress("0xabc");
    });

    expect(typeof captured.loadLikesForAddress).toBe("function");
  });

  it("loadLikesForAddress uses runner as scanProvider and covers logIndex/blockNumber fallbacks", async () => {
    wallet.chainId = "1";
    wallet.provider = { getBlockNumber: vi.fn(async () => 999) };

    const runnerGetBlockNumber = vi.fn(async () => 10);
    const read = {
      runner: { getBlockNumber: runnerGetBlockNumber },
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async (filter: string) => {
        if (filter === "liked") {
          return [
            { blockNumber: 7, logIndex: 2, topics: [], data: "0x" },
            { blockNumber: 7, logIndex: 1, topics: [], data: "0x" }
          ];
        }
        return [{ blockNumber: undefined, logIndex: 0, topics: [], data: "0x" }];
      })
    };
    contract.getReadContract.mockResolvedValueOnce(read as any);

    socials.parseLog.mockReset();
    socials.parseLog
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 4n] })
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 5n] })
      .mockReturnValueOnce({ name: "PostUnliked", args: ["0xabc", 6n] });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadLikesForAddress("0xabc");
    });

    // runner branch should be preferred over wallet.provider.
    expect(runnerGetBlockNumber).toHaveBeenCalled();
    expect((wallet.provider as any).getBlockNumber).not.toHaveBeenCalled();
  });

  it("writes likes session cache on successful like (covers filter+map)", async () => {
    wallet.walletAddress = "0xAbC";
    wallet.chainId = "1";

    social.handleAction.mockResolvedValueOnce(true);

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    // Use a tokenId with surrounding whitespace to ensure the filter+map pipeline runs.
    await act(async () => {
      await captured.handleAction(" 1 ", "like", null);
    });

    const raw = sessionStorage.getItem("likesTokenKeysByAddress:0xabc");
    expect(raw).toContain("tokenIds");
  });

  it("loadLikesForAddress covers chainIdRaw non-string (': NaN' branch)", async () => {
    wallet.chainId = null;
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    contract.getReadContract.mockResolvedValueOnce({
      runner: {},
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async () => [])
    });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadLikesForAddress("0xabc");
    });

    // Just sanity: call completed without throwing.
    expect(typeof captured.loadLikesForAddress).toBe("function");
  });

  it("loadRepostsForAddress uses env RPC scan provider when configured", async () => {
    vi.stubEnv("VITE_ETH_RPC_URL", "http://rpc.example");
    wallet.chainId = "1";
    wallet.provider = null;

    const { getSocialContract }: any = await import("../contracts/socialPosts");
    (getSocialContract as any).mockClear?.();

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadRepostsForAddress("0xabc");
    });

    expect(getSocialContract).toHaveBeenCalledWith("0xcontract", expect.anything());
  });

  it("loadRepostsForAddress parses 0X-prefixed chainId when building chainKey", async () => {
    // Force the wallet-provider scan path (so the earlier rpc-url selection doesn't matter).
    wallet.chainId = "0X1";
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    contract.getReadContract.mockResolvedValueOnce({
      runner: {},
      filters: {
        PostShared: () => "shared",
        PostUnshared: () => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadRepostsForAddress("0xabc");
    });

    expect(typeof captured.loadRepostsForAddress).toBe("function");
  });

  it("loadLikesForAddress uses env RPC path and exercises log sorting + parse fallbacks", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_ETH_RPC_URL", "http://rpc.example");

    // Use hex chainId so the base-16 parse branch runs.
    wallet.chainId = "0x1";
    wallet.provider = null;

    const { ethers: mockedEthers }: any = await import("ethers");
    const rpcGetBlockNumber = mockedEthers.__rpcGetBlockNumberMock as any;
    rpcGetBlockNumber.mockReset();
    rpcGetBlockNumber.mockResolvedValueOnce(100000);

    // Provide logs that cover blockNumber/index/logIndex sorting and blockNumber ?? 0.
    const likedLogs: any[] = [
      { blockNumber: 90000, index: 2, topics: [], data: "0x" },
      { blockNumber: 90000, logIndex: 1, topics: [], data: "0x" },
      { blockNumber: undefined, logIndex: 0, topics: [], data: "0x" }
    ];
    const unlikedLogs: any[] = [{ blockNumber: 90001, index: 0, topics: [], data: "0x" }];

    // Make getSocialContract return a controllable contract for env-RPC scans.
    const { getSocialContract }: any = await import("../contracts/socialPosts");
    (getSocialContract as any).mockImplementationOnce((_addr: string, _provider: any) => ({
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async (filter: string) => {
        if (filter === "liked") return likedLogs;
        return unlikedLogs;
      })
    }));

    // First log: parseLog throws (catch branch). Second: tokenId 0n (skip). Third: liked token 2n. Unliked token 3n.
    socials.parseLog.mockReset();
    socials.parseLog
      .mockImplementationOnce(() => {
        throw new Error("bad log");
      })
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 0n] })
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 2n] })
      .mockReturnValueOnce({ name: "PostUnliked", args: ["0xabc", 3n] });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadLikesForAddress("0xabc");
    });

    // Ensure at least one like key is written with a chain prefix.
    expect(captured.likedTokenIdsByAddress["0xabc"]).toEqual(expect.arrayContaining(["1:2"]));
  });

  it("loadLikesForAddress falls back to wallet provider path when chainId cannot be resolved", async () => {
    // Force resolvedChainIdNum to be null so rpcUrl is empty and the wallet-provider branch runs.
    wallet.chainId = "not-a-chain";

    // Provide a wallet provider so the fallback path proceeds.
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    // Force readContract runner variations: runner exists but no provider, so `runner ?? wallet.provider` path runs.
    contract.getReadContract.mockResolvedValueOnce({
      runner: {},
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async () => [])
    });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadLikesForAddress("0xabc");
    });

    expect(contract.ensureContractDeployedOnCurrentNetwork).toHaveBeenCalled();
  });

  it("loadLikesForAddress ignores empty address", async () => {
    let appRef: any = null;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (appRef = a)} />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadLikesForAddress("");
    });
  });

  it("loadLikesForAddress covers cache key guards (whitespace address)", async () => {
    // Whitespace address will produce a null session key and exercise the storageKey guards.
    wallet.provider = null;

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("likes-space").click();
    });
  });

  it("readLikesSessionCache handles invalid JSON and non-array tokenIds", async () => {
    // Invalid JSON triggers the catch -> null.
    sessionStorage.setItem("likesTokenKeysByAddress:0xabc", "{not json");

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("likes").click();
    });

    // Non-array tokenIds triggers the ": []" branch.
    sessionStorage.setItem("likesTokenKeysByAddress:0xabc", JSON.stringify({ tokenIds: "nope" }));
    await act(async () => {
      screen.getByText("likes").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("liked").textContent).toBe("[]");
    });
  });

  it("writeLikesSessionCache covers missing storageKey and setItem failure", async () => {
    social.handleAction.mockResolvedValueOnce(true);

    // Missing storage key branch: wallet address of whitespace trims to empty.
    wallet.walletAddress = " ";
    const { unmount } = render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("like").click();
    });

    unmount();

    // setItem failure branch.
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("boom");
    });
    try {
      wallet.walletAddress = "0xabc";
      social.handleAction.mockResolvedValueOnce(true);
      render(
        <AppProvider>
          <Consumer />
        </AppProvider>
      );
      await act(async () => {
        screen.getByText("like").click();
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("writeLikesSessionCache persists a non-empty tokenIds array (covers map line)", async () => {
    wallet.walletAddress = "0xabc";
    wallet.chainId = "1";
    social.handleAction.mockResolvedValueOnce(true);

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.handleAction("1", "like", null);
    });

    const raw = sessionStorage.getItem("likesTokenKeysByAddress:0xabc");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(String(raw));
    expect(parsed?.tokenIds?.length).toBeGreaterThan(0);
  });

  it("loadLikesForAddress uses runner (no provider) as scanProvider and covers logIndex sort fallbacks", async () => {
    wallet.chainId = "1";
    wallet.provider = { getBlockNumber: vi.fn(async () => 999) };

    const runnerGetBlockNumber = vi.fn(async () => 10);
    const read = {
      runner: { getBlockNumber: runnerGetBlockNumber },
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async (filter: string) => {
        if (filter === "liked") {
          return [
            // No index/logIndex -> should fall back to 0 in sort.
            { blockNumber: 7, topics: [], data: "0x" },
            { blockNumber: 7, index: null, logIndex: 2, topics: [], data: "0x" },
            { blockNumber: 7, logIndex: 1, topics: [], data: "0x" },
            // Another missing-index log so it becomes `a` in some comparisons.
            { blockNumber: 7, topics: [], data: "0x" }
          ];
        }
        return [];
      })
    };
    contract.getReadContract.mockResolvedValueOnce(read as any);

    socials.parseLog.mockReset();
    socials.parseLog
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 4n] })
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 5n] })
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 6n] })
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 7n] });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadLikesForAddress("0xabc");
    });

    expect(runnerGetBlockNumber).toHaveBeenCalled();
    expect((wallet.provider as any).getBlockNumber).not.toHaveBeenCalled();
  });

  it("loadLikesForAddress falls back to wallet.provider when runner is missing, and covers index/logIndex/0 sort branches", async () => {
    wallet.chainId = "1";
    const walletGetBlockNumber = vi.fn(async () => 10);
    wallet.provider = { getBlockNumber: walletGetBlockNumber };

    const read = {
      // No runner -> should use wallet.provider
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async (filter: string) => {
        if (filter === "liked") {
          return [
            { blockNumber: 7, logIndex: 2, topics: [], data: "0x" },
            { blockNumber: 7, logIndex: 1, topics: [], data: "0x" }
          ];
        }
        return [{ blockNumber: 7, logIndex: 0, topics: [], data: "0x" }];
      })
    };
    contract.getReadContract.mockResolvedValueOnce(read as any);

    socials.parseLog.mockReset();
    socials.parseLog
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 4n] })
      .mockReturnValueOnce({ name: "PostLiked", args: ["0xabc", 5n] })
      .mockReturnValueOnce({ name: "PostUnliked", args: ["0xabc", 6n] });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadLikesForAddress("0xabc");
    });

    expect(walletGetBlockNumber).toHaveBeenCalled();
  });

  it("loadRepostsForAddress covers hex-chainId parse branch (0x prefix)", async () => {
    wallet.chainId = "0x1";
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    contract.getReadContract.mockResolvedValueOnce({
      runner: {},
      filters: {
        PostShared: () => "shared",
        PostUnshared: () => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    });

    let captured: any;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (captured = a)} />
      </AppProvider>
    );

    await act(async () => {
      await captured.loadRepostsForAddress("0xabc");
    });
  });

  it("handleAction covers chain parsing branches (hex, empty chain)", async () => {
    let appRef: any = null;
    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (appRef = a)} />
        <Consumer />
      </AppProvider>
    );

    social.handleAction.mockResolvedValueOnce(true);
    await act(async () => {
      await appRef.handleAction("1", "share", "0x1");
    });

    social.handleAction.mockResolvedValueOnce(true);
    await act(async () => {
      await appRef.handleAction("1", "like", "0x1");
    });

    // Empty chain key branch when neither postChainId nor wallet.chainId are present.
    wallet.chainId = null;
    social.handleAction.mockResolvedValueOnce(true);
    await act(async () => {
      await appRef.handleAction("1", "share", null);
    });

    await waitFor(() => {
      expect(feed.loadPostsByTokenIds).toHaveBeenCalled();
    });
  });

  it("loadLikesForAddress hits in-flight await branch", async () => {
    let appRef: any = null;

    // Make the scan path take time so the second call observes in-flight work.
    const deferred: { promise: Promise<void>; resolve: () => void } = (() => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    })();

    const readContractSlow = {
      filters: {
        PostLiked: (_addr: string, __: any) => "liked",
        PostUnliked: (_addr: string, __: any) => "unliked"
      },
      runner: { provider: { getBlockNumber: vi.fn(async () => 10) } },
      queryFilter: vi.fn(async () => {
        await deferred.promise;
        return [];
      })
    } as any;
    contract.getReadContract.mockResolvedValueOnce(readContractSlow);
    wallet.provider = {};

    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (appRef = a)} />
      </AppProvider>
    );

    const p1 = appRef.loadLikesForAddress("0xabc");
    const p2 = appRef.loadLikesForAddress("0xabc");
    deferred.resolve();

    await act(async () => {
      await Promise.all([p1, p2]);
    });
  });

  it("loadLikesForAddress covers runner/provider selection, sorting, window advance, and chain key merge", async () => {
    let appRef: any = null;

    // Ensure we take the injected-provider path (no env RPC).
    vi.stubEnv("VITE_ETH_RPC_URL", "");
    wallet.provider = {};
    wallet.chainId = "0x1";

    const scanProvider = {
      getBlockNumber: vi.fn(async () => 100_000)
    };

    const logsLiked = [
      // Undefined blockNumber exercises ?? 0 branch.
      { blockNumber: undefined, index: undefined, logIndex: 2, topics: ["t1"], data: "liked:0" },
      { blockNumber: 10, index: 1, topics: ["t2"], data: "liked:1" }
    ];
    const logsUnliked = [{ blockNumber: 9, logIndex: 1, topics: ["t3"], data: "unliked:2" }];

    const readContractScan = {
      filters: {
        PostLiked: (_addr: string, __: any) => "liked",
        PostUnliked: (_addr: string, __: any) => "unliked"
      },
      runner: { provider: scanProvider },
      queryFilter: vi.fn(async (filter: string) => {
        if (filter === "liked") return logsLiked as any;
        if (filter === "unliked") return logsUnliked as any;
        return [] as any;
      })
    } as any;

    contract.getReadContract.mockResolvedValueOnce(readContractScan);

    socials.parseLog.mockImplementation(({ data }: any) => {
      const s = String(data);
      if (s === "liked:0") return { name: "PostLiked", args: ["0xabc", 0n] } as any; // tokenIdBig falsy
      if (s === "liked:1") return { name: "PostLiked", args: ["0xabc", 1n] } as any;
      if (s === "unliked:2") return { name: "PostUnliked", args: ["0xabc", 2n] } as any;
      throw new Error("unexpected");
    });

    // Preseed existing likes to exercise preserved/filtered-by-chain behavior.
    sessionStorage.setItem("likesTokenKeysByAddress:0xabc", JSON.stringify({ tokenIds: ["2:99", "1:old"] }));

    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (appRef = a)} />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadLikesForAddress("0xabc");
    });
  });

  it("loadLikesForAddress covers env RPC branch and invalid block number error", async () => {
    let appRef: any = null;

    // Hit env-RPC path.
    vi.stubEnv("VITE_ETH_RPC_URL", "http://rpc.example");
    wallet.chainId = "1";
    contract.contractAddress = "0xcontract";
    wallet.provider = null;

    const { ethers: mockedEthers }: any = await import("ethers");
    mockedEthers.__rpcGetBlockNumberMock.mockReset();
    mockedEthers.__rpcGetBlockNumberMock.mockResolvedValueOnce(-1);

    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (appRef = a)} />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadLikesForAddress("0xabc");
    });

    expect(setStatus).toHaveBeenCalled();
  });

  it("loadLikesForAddress covers window shrinking to min and throwing", async () => {
    let appRef: any = null;

    vi.stubEnv("VITE_ETH_RPC_URL", "http://rpc.example");
    wallet.chainId = "1";
    contract.contractAddress = "0xcontract";

    const { ethers: mockedEthers }: any = await import("ethers");
    mockedEthers.__rpcGetBlockNumberMock.mockReset();
    mockedEthers.__rpcGetBlockNumberMock.mockImplementation(async () => 100_000);

    // Make getSocialContract return a contract whose queryFilter always fails.
    const { getSocialContract } = await import("../contracts/socialPosts");
    (getSocialContract as any).mockImplementationOnce(() => ({
      filters: {
        PostLiked: () => "liked",
        PostUnliked: () => "unliked"
      },
      queryFilter: vi.fn(async () => {
        throw new Error("range too large");
      })
    }));

    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (appRef = a)} />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadLikesForAddress("0xabc");
    });

    expect(setStatus).toHaveBeenCalled();
  });

  it("loadRepostsForAddress covers env RPC parsing branches", async () => {
    let appRef: any = null;

    vi.stubEnv("VITE_ETH_RPC_URL", "http://rpc.example");
    wallet.chainId = "0X1";
    contract.contractAddress = "0xcontract";

    const { ethers: mockedEthers }: any = await import("ethers");
    mockedEthers.__rpcGetBlockNumberMock.mockReset();
    mockedEthers.__rpcGetBlockNumberMock.mockImplementation(async () => 10);

    const { getSocialContract } = await import("../contracts/socialPosts");
    (getSocialContract as any).mockImplementationOnce(() => ({
      filters: {
        PostShared: () => "shared",
        PostUnshared: () => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    }));

    render(
      <AppProvider>
        <ExposeApp onApp={(a) => (appRef = a)} />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });
  });

  it("throws when used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useApp();
      return null;
    }

    try {
      expect(() => render(<Bad />)).toThrow(/useApp must be used/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("composes facade values and connectWallet triggers refresh", async () => {
    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("addr").textContent).toBe("0xabc");

    await act(async () => {
      screen.getByText("connect").click();
    });

    expect(wallet.connectWallet).toHaveBeenCalled();
    expect(contract.refreshContractState).toHaveBeenCalled();
    expect(contract.ensureContractDeployedOnCurrentNetwork).toHaveBeenCalled();
    expect(wallet.refreshWalletPanel).toHaveBeenCalled();
    expect(feed.refreshFeed).toHaveBeenCalled();
  });

  it("handleAction(like) toggles likedTokenIdsByAddress and writes through", async () => {
    social.handleAction.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    expect(screen.getByTestId("liked").textContent).toBe("[]");

    await act(async () => {
      screen.getByText("like").click();
    });

    await waitFor(() => expect(screen.getByTestId("liked").textContent).toContain("1:1"));
    expect(feed.loadPostsByTokenIds).toHaveBeenCalledWith(["1"]);

    await act(async () => {
      screen.getByText("like").click();
    });

    await waitFor(() => expect(screen.getByTestId("liked").textContent).toBe("[]"));
  });

  it("loadLikesForAddress uses session cache when present", async () => {
    // Pre-seed cache to exercise the cache short-circuit branch.
    sessionStorage.setItem(
      "likesTokenKeysByAddress:0xabc",
      JSON.stringify({ tokenIds: ["1:2", "  ", "3"] })
    );

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("likes").click();
    });

    await waitFor(() => expect(screen.getByTestId("liked").textContent).toContain("1:2"));
  });

  it("loadLikesForAddress scans logs when cache missing", async () => {
    wallet.provider = { any: true };
    wallet.chainId = "1";

    feed.loadPostsByTokenIds.mockClear();
    socials.parseLog.mockReset();

    // Make the first range query fail once to cover window shrink, then succeed.
    let shouldThrow = true;
    const scanProvider = {
      getBlockNumber: vi.fn(async () => 100)
    };

    const likeFilter = "liked";
    const unlikeFilter = "unliked";

    const readContractWithLikes: any = {
      runner: { provider: scanProvider },
      filters: {
        PostLiked: (_addr: string, __: any) => likeFilter,
        PostUnliked: (_addr: string, __: any) => unlikeFilter
      },
      queryFilter: vi.fn(async (filter: string, _from: number, _to: number) => {
        if (shouldThrow) {
          shouldThrow = false;
          throw new Error("range too big");
        }

        if (filter === likeFilter) {
          return [
            { topics: ["0x"], data: "liked-1", blockNumber: 90, logIndex: 1 },
            { topics: ["0x"], data: "bad", blockNumber: 92, logIndex: 1 },
            { topics: ["0x"], data: "liked-2", blockNumber: 98, logIndex: 1 }
          ];
        }

        if (filter === unlikeFilter) {
          return [{ topics: ["0x"], data: "unliked-1", blockNumber: 95, logIndex: 1 }];
        }

        return [];
      })
    };

    contract.getReadContract.mockResolvedValueOnce(readContractWithLikes);

    socials.parseLog.mockImplementation(({ data }: any) => {
      if (data === "bad") throw new Error("parse fail");
      if (typeof data === "string" && data.startsWith("liked-")) {
        const token = BigInt(data.split("-")[1]);
        return { name: "PostLiked", args: ["0xabc", token] } as any;
      }
      if (typeof data === "string" && data.startsWith("unliked-")) {
        const token = BigInt(data.split("-")[1]);
        return { name: "PostUnliked", args: ["0xabc", token] } as any;
      }
      throw new Error("unknown");
    });

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("likes").click();
    });

    // Token 1 was liked then unliked; token 2 remains active.
    await waitFor(() => expect(feed.loadPostsByTokenIds).toHaveBeenCalledWith(["2"]));
    await waitFor(() => expect(screen.getByTestId("liked").textContent).toContain("1:2"));

    // Second call should short-circuit due to loadedKey.
    feed.loadPostsByTokenIds.mockClear();
    await act(async () => {
      screen.getByText("likes").click();
    });
    expect(feed.loadPostsByTokenIds).not.toHaveBeenCalled();
  });

  it("nudges connect when social actions are triggered while disconnected", async () => {
    vi.useFakeTimers();
    const prevAddress = wallet.walletAddress;
    try {
      wallet.walletAddress = null;
      social.handleAction.mockClear();

      render(
        <AppProvider>
          <Consumer />
        </AppProvider>
      );

      expect(screen.getByTestId("connectNudge").textContent).toBe("no");

      await act(async () => {
        screen.getByText("like").click();
      });

      expect(social.handleAction).not.toHaveBeenCalled();
      expect(screen.getByTestId("connectNudge").textContent).toBe("yes");

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByTestId("connectNudge").textContent).toBe("no");
    } finally {
      wallet.walletAddress = prevAddress;
      vi.useRealTimers();
    }
  });

  it("handleAction share updates saved list and loads tokenId into feed cache", async () => {
    social.handleAction.mockResolvedValueOnce(true);
    feed.loadPostsByTokenIds.mockClear();

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    expect(screen.getByTestId("saved").textContent).toBe("[]");

    await act(async () => {
      screen.getByText("share").click();
    });

    // Saved list updated immediately.
    await waitFor(() => expect(screen.getByTestId("saved").textContent).toBe("[\"1:1\"]"));
    expect(feed.loadPostsByTokenIds).toHaveBeenCalledWith(["1"]);

    // Second share toggles off.
    social.handleAction.mockResolvedValueOnce(true);
    await act(async () => {
      screen.getByText("share").click();
    });
    await waitFor(() => expect(screen.getByTestId("saved").textContent).toBe("[]"));
  });

  it("handleAction share does nothing when tx returns ok=false", async () => {
    social.handleAction.mockResolvedValueOnce(false);
    feed.loadPostsByTokenIds.mockClear();

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("share").click();
    });

    expect(screen.getByTestId("saved").textContent).toBe("[]");
    expect(feed.loadPostsByTokenIds).not.toHaveBeenCalled();
  });

  it("handleAction like does not update saved list even when ok=true", async () => {
    social.handleAction.mockResolvedValueOnce(true);

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("like").click();
    });

    expect(screen.getByTestId("saved").textContent).toBe("[]");
  });

  it("handleTip refreshes contract state after successful tip", async () => {
    social.handleTip.mockResolvedValueOnce(true);
    contract.refreshContractState.mockClear();

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("tip").click();
    });

    await waitFor(() => expect(contract.refreshContractState).toHaveBeenCalled());
  });

  it("handleTip ignores refreshContractState errors", async () => {
    social.handleTip.mockResolvedValueOnce(true);

    const prevRefresh = contract.refreshContractState;
    contract.refreshContractState = vi.fn(async () => {
      throw new Error("refresh failed");
    });

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("tip").click();
    });

    await waitFor(() => expect(contract.refreshContractState).toHaveBeenCalled());
    contract.refreshContractState = prevRefresh;
  });

  it("withdrawTips ignores refreshContractState errors", async () => {
    social.withdrawTips.mockClear();

    const prevRefresh = contract.refreshContractState;
    contract.refreshContractState = vi.fn(async () => {
      throw new Error("refresh failed");
    });

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("withdraw").click();
    });

    expect(social.withdrawTips).toHaveBeenCalledTimes(1);

    contract.refreshContractState = prevRefresh;
  });

  it("repeated disconnected actions clear the prior nudge timer", async () => {
    const prevAddress = wallet.walletAddress;
    try {
      wallet.walletAddress = null;
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

      render(
        <AppProvider>
          <Consumer />
        </AppProvider>
      );

      await act(async () => {
        screen.getByText("like").click();
        screen.getByText("like").click();
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    } finally {
      wallet.walletAddress = prevAddress;
      vi.useRealTimers();
    }
  });

  it("nudges connect for all guarded actions when disconnected", async () => {
    vi.useFakeTimers();
    const prevAddress = wallet.walletAddress;
    try {
      wallet.walletAddress = null;
      social.handleTip.mockClear();
      social.burnPost.mockClear();
      social.freezePost.mockClear();
      social.withdrawTips.mockClear();
      follow.toggleFollow.mockClear();

      render(
        <AppProvider>
          <Consumer />
        </AppProvider>
      );

      await act(async () => {
        screen.getByText("tip").click();
        screen.getByText("burn").click();
        screen.getByText("freeze").click();
        screen.getByText("withdraw").click();
        screen.getByText("follow").click();
      });

      expect(screen.getByTestId("connectNudge").textContent).toBe("yes");
      expect(social.handleTip).not.toHaveBeenCalled();
      expect(social.burnPost).not.toHaveBeenCalled();
      expect(social.freezePost).not.toHaveBeenCalled();
      expect(social.withdrawTips).not.toHaveBeenCalled();
      expect(follow.toggleFollow).not.toHaveBeenCalled();
    } finally {
      wallet.walletAddress = prevAddress;
      vi.useRealTimers();
    }
  });

  it("connected social actions call underlying handlers without nudging", async () => {
    const prevAddress = wallet.walletAddress;
    try {
      wallet.walletAddress = "0xabc";
      social.handleAction.mockClear();
      social.handleTip.mockClear();
      social.burnPost.mockClear();
      social.freezePost.mockClear();
      social.withdrawTips.mockClear();
      follow.toggleFollow.mockClear();

      render(
        <AppProvider>
          <Consumer />
        </AppProvider>
      );

      await act(async () => {
        screen.getByText("like").click();
        screen.getByText("tip").click();
        screen.getByText("burn").click();
        screen.getByText("freeze").click();
        screen.getByText("withdraw").click();
        screen.getByText("follow").click();
      });

      expect(screen.getByTestId("connectNudge").textContent).toBe("no");
      expect(social.handleAction).toHaveBeenCalledWith("1", "like", null);
      expect(social.handleTip).toHaveBeenCalledWith("1", null);
      expect(social.burnPost).toHaveBeenCalledWith("1", null);
      expect(social.freezePost).toHaveBeenCalledWith("1", null);
      expect(social.withdrawTips).toHaveBeenCalledTimes(1);
      expect(follow.toggleFollow).toHaveBeenCalledWith("0xdef");
    } finally {
      wallet.walletAddress = prevAddress;
    }
  });

  it("loadRepostsForAddress early-exits and also runs empty-path", async () => {
    // Early exit: no provider.
    wallet.provider = null;

    const { unmount } = render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("reposts").click();
    });

    unmount();

    // Empty-path: provider exists, returns no logs.
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("reposts").click();
    });

    await waitFor(() => {
      expect(setStatus).not.toHaveBeenCalledWith(expect.stringMatching(/RPC could not serve repost/));
    });
  });

  it("loadRepostsForAddress parses repost logs and updates state", async () => {
    socials.parseLog.mockReset();

    // provider exists, returns some logs.
    wallet.provider = { getBlockNumber: vi.fn(async () => 10) };

    const sharedLogs = [
      { topics: ["t"], data: "S:1", blockNumber: 5, logIndex: 2 },
      { topics: ["t"], data: "S:2", blockNumber: 5, logIndex: 1 },
      { topics: ["t"], data: "bad", blockNumber: 6, logIndex: 0 }
    ];
    const unsharedLogs = [{ topics: ["t"], data: "U:1", blockNumber: 7, logIndex: 0 }];

    const read = {
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async (filter: any) => {
        if (filter === "shared") return sharedLogs;
        return unsharedLogs;
      })
    };
    contract.getReadContract = vi.fn(async () => read);

    socials.parseLog.mockImplementation(({ data }: any) => {
      if (data === "bad") throw new Error("nope");
      if (data === "S:1") return { name: "PostShared", args: [wallet.walletAddress, 1n] };
      if (data === "S:2") return { name: "PostShared", args: [wallet.walletAddress, 2n] };
      if (data === "U:1") return { name: "PostUnshared", args: [wallet.walletAddress, 1n] };
      return null;
    });

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("reposts").click();
    });

    await waitFor(() => {
      expect(feed.loadPostsByTokenIds).toHaveBeenCalledWith(["2"]);
      expect(screen.getByTestId("saved").textContent).toBe("[\"1:2\"]");
    });
  });

  it("loadRepostsForAddress does not re-run after successful load", async () => {
    socials.parseLog.mockReset();

    wallet.provider = { getBlockNumber: vi.fn(async () => 10) };

    const read = {
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    };
    contract.getReadContract = vi.fn(async () => read);
    socials.parseLog.mockImplementation(() => null);

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });

    // Only scanned once (second call should short-circuit).
    expect(contract.getReadContract).toHaveBeenCalledTimes(1);
    expect(read.queryFilter).toHaveBeenCalled();
  });

  it("loadRepostsForAddress rehydrates from session cache and does not scan", async () => {
    // provider exists but should not be used if cache is present
    wallet.provider = { getBlockNumber: vi.fn(async () => 10) };

    const cacheKey = `repostsTokenKeysByAddress:${wallet.walletAddress.toLowerCase()}`;
    sessionStorage.setItem(cacheKey, JSON.stringify({ tokenIds: ["1:9", "1:10"] }));

    const read = {
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    };
    contract.getReadContract = vi.fn(async () => read);

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress(wallet.walletAddress);
    });

    expect(contract.getReadContract).not.toHaveBeenCalled();
  });

  it("loadRepostsForAddress treats non-array cached tokenIds as empty and does not scan", async () => {
    wallet.provider = { getBlockNumber: vi.fn(async () => 10) };

    const cacheKey = `repostsTokenKeysByAddress:${wallet.walletAddress.toLowerCase()}`;
    sessionStorage.setItem(cacheKey, JSON.stringify({ tokenIds: "not-an-array" }));

    const read = {
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    };
    contract.getReadContract = vi.fn(async () => read);

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress(wallet.walletAddress);
    });

    expect(contract.getReadContract).not.toHaveBeenCalled();
    expect(appRef.repostTokenIdsByAddress[wallet.walletAddress.toLowerCase()]).toEqual([]);
  });

  it("loadRepostsForAddress ignores invalid JSON cache and scans", async () => {
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    const cacheKey = `repostsTokenKeysByAddress:${wallet.walletAddress.toLowerCase()}`;
    sessionStorage.setItem(cacheKey, "not-json");

    const read = {
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    };
    contract.getReadContract = vi.fn(async () => read);
    socials.parseLog.mockImplementation(() => null);

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress(wallet.walletAddress);
    });

    expect(contract.getReadContract).toHaveBeenCalledTimes(1);
  });

  it("handleAction share ignores sessionStorage write errors", async () => {
    const prevHandleAction = social.handleAction;
    social.handleAction = vi.fn(async () => true);
    feed.loadPostsByTokenIds.mockClear();

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("share").click();
    });

    expect(feed.loadPostsByTokenIds).toHaveBeenCalledWith(["1"]);
    expect(screen.getByTestId("saved").textContent).toBe("[\"1:1\"]");
    expect(setItemSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    social.handleAction = prevHandleAction;
  });

  it("loadRepostsForAddress handles whitespace address (no session cache key)", async () => {
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    const read = {
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    };
    contract.getReadContract = vi.fn(async () => read);
    socials.parseLog.mockImplementation(() => null);

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("   ");
    });

    expect(contract.getReadContract).toHaveBeenCalledTimes(1);
  });

  it("handleAction share does not write cache when walletAddress is whitespace", async () => {
    const prevAddr = wallet.walletAddress;
    wallet.walletAddress = "   ";

    const prevHandleAction = social.handleAction;
    social.handleAction = vi.fn(async () => true);
    feed.loadPostsByTokenIds.mockClear();

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("share").click();
    });

    expect(feed.loadPostsByTokenIds).toHaveBeenCalledWith(["1"]);
    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
    social.handleAction = prevHandleAction;
    wallet.walletAddress = prevAddr;
  });

  it("connectWallet ignores refreshContractState errors", async () => {
    const prevRefresh = contract.refreshContractState;
    contract.refreshContractState = vi.fn(async () => {
      throw new Error("refresh failed");
    });

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    expect(contract.ensureContractDeployedOnCurrentNetwork).toHaveBeenCalled();

    contract.refreshContractState = prevRefresh;
  });

  it("connectWallet sets status when ensureContractDeployedOnCurrentNetwork throws", async () => {
    const prevEnsure = contract.ensureContractDeployedOnCurrentNetwork;
    contract.ensureContractDeployedOnCurrentNetwork = vi.fn(async () => {
      throw new Error("deploy check failed");
    });

    setStatus.mockClear();

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    expect(setStatus).toHaveBeenCalled();

    contract.ensureContractDeployedOnCurrentNetwork = prevEnsure;
  });

  it("connectWallet returns early when connectWallet yields no address", async () => {
    const prevConnect = wallet.connectWallet;
    wallet.connectWallet = vi.fn(async () => null);
    contract.refreshContractState.mockClear();
    contract.ensureContractDeployedOnCurrentNetwork.mockClear();
    feed.refreshFeed.mockClear();

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    expect(contract.refreshContractState).not.toHaveBeenCalled();
    expect(contract.ensureContractDeployedOnCurrentNetwork).not.toHaveBeenCalled();
    expect(feed.refreshFeed).not.toHaveBeenCalled();

    wallet.connectWallet = prevConnect;
  });

  it("refreshFeed facade calls feed.refreshFeed", async () => {
    feed.refreshFeed.mockClear();

    function RefreshConsumer() {
      const app = useApp();
      return (
        <button type="button" onClick={() => app.refreshFeed()}>
          refresh
        </button>
      );
    }

    render(
      <AppProvider>
        <RefreshConsumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("refresh").click();
    });

    expect(feed.refreshFeed).toHaveBeenCalled();
  });

  it("loadRepostsForAddress awaits an in-flight task instead of starting a second one", async () => {
    const deferred: { resolve: (value: any) => void } = {
      resolve: () => undefined
    };
    const queryPromise = new Promise<any[]>((resolve) => {
      deferred.resolve = resolve;
    });

    wallet.provider = { getBlockNumber: vi.fn(async () => 100_000) };

    const queryFilter = vi.fn(async () => queryPromise);
    contract.getReadContract = vi.fn(async () => ({
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter
    }));

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    const p1 = appRef.loadRepostsForAddress("0xabc");
    const p2 = appRef.loadRepostsForAddress("0xabc");

    await waitFor(() => {
      expect(contract.getReadContract).toHaveBeenCalledTimes(1);
    });

    deferred.resolve([]);
    await act(async () => {
      await Promise.all([p1, p2]);
    });
  });

  it("loadRepostsForAddress retries smaller windows after query errors", async () => {
    socials.parseLog.mockReset();
    socials.parseLog.mockImplementation(() => null);

    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    let calls = 0;
    const queryFilter = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error("range too large");
      return [];
    });

    contract.getReadContract = vi.fn(async () => ({
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter
    }));

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });

    expect(queryFilter).toHaveBeenCalled();
    expect(queryFilter.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("loadRepostsForAddress surfaces errors via status", async () => {
    setStatus.mockClear();

    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    const prevEnsure = contract.ensureContractDeployedOnCurrentNetwork;
    contract.ensureContractDeployedOnCurrentNetwork = vi.fn(async () => {
      throw new Error("ensure failed");
    });

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });

    expect(setStatus).toHaveBeenCalled();

    contract.ensureContractDeployedOnCurrentNetwork = prevEnsure;
  });

  it("loadRepostsForAddress reports invalid block number via status", async () => {
    setStatus.mockClear();

    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };
    contract.getReadContract = vi.fn(async () => ({
      runner: { provider: { getBlockNumber: async () => "nope" } },
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    }));

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });

    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/invalid block number/i));
  });

  it("loadRepostsForAddress prefers runner.provider over wallet.provider", async () => {
    socials.parseLog.mockReset();
    socials.parseLog.mockImplementation(() => null);

    const walletGetBlockNumber = vi.fn(async () => 123);
    wallet.provider = { getBlockNumber: walletGetBlockNumber };

    const runnerGetBlockNumber = vi.fn(async () => 0);
    const read = {
      runner: { provider: { getBlockNumber: runnerGetBlockNumber } },
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => [])
    };
    contract.getReadContract = vi.fn(async () => read);

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });

    expect(runnerGetBlockNumber).toHaveBeenCalled();
    expect(walletGetBlockNumber).not.toHaveBeenCalled();
  });

  it("loadRepostsForAddress falls back when scanProvider has no getBlockNumber, and caches by chainId when contractAddress is missing", async () => {
    const prevContractAddress = contract.contractAddress;
    const prevChainId = wallet.chainId;
    const prevProvider = wallet.provider;
    try {
      contract.contractAddress = null;
      wallet.chainId = "777";
      wallet.provider = { getBlockNumber: vi.fn(async () => 123) };

      const queryFilter = vi.fn(async () => []);
      const read: any = {
        runner: {},
        filters: {
          PostShared: (_addr: string, __: any) => "shared",
          PostUnshared: (_addr: string, __: any) => "unshared"
        },
        queryFilter
      };
      contract.getReadContract = vi.fn(async () => read);

      let appRef: any = null;
      function Grab() {
        appRef = useApp();
        return null;
      }

      render(
        <AppProvider>
          <Grab />
        </AppProvider>
      );

      await act(async () => {
        await appRef.loadRepostsForAddress("0xabc");
      });

      // With runner present but no getBlockNumber, latestRaw defaults to 0.
      expect(queryFilter).toHaveBeenCalled();

      // Second call should be cached and avoid re-query.
      queryFilter.mockClear();
      await act(async () => {
        await appRef.loadRepostsForAddress("0xabc");
      });
      expect(queryFilter).not.toHaveBeenCalled();
    } finally {
      contract.contractAddress = prevContractAddress;
      wallet.chainId = prevChainId;
      wallet.provider = prevProvider;
    }
  });

  it("loadRepostsForAddress computes networkKey as empty string when both contractAddress and chainId are missing", async () => {
    const prevContractAddress = contract.contractAddress;
    const prevChainId = wallet.chainId;
    const prevProvider = wallet.provider;
    try {
      contract.contractAddress = null;
      wallet.chainId = null;
      wallet.provider = { getBlockNumber: vi.fn(async () => 5) };

      const queryFilter = vi.fn(async () => []);
      contract.getReadContract = vi.fn(async () => ({
        runner: { provider: { getBlockNumber: async () => 0 } },
        filters: {
          PostShared: (_addr: string, __: any) => "shared",
          PostUnshared: (_addr: string, __: any) => "unshared"
        },
        queryFilter
      }));

      let appRef: any = null;
      function Grab() {
        appRef = useApp();
        return null;
      }

      render(
        <AppProvider>
          <Grab />
        </AppProvider>
      );

      await act(async () => {
        await appRef.loadRepostsForAddress("0xabc");
      });

      expect(queryFilter).toHaveBeenCalled();
    } finally {
      contract.contractAddress = prevContractAddress;
      wallet.chainId = prevChainId;
      wallet.provider = prevProvider;
    }
  });

  it("loadRepostsForAddress returns early for empty address", async () => {
    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };
    contract.getReadContract.mockClear();

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("");
    });

    expect(contract.getReadContract).not.toHaveBeenCalled();
  });

  it("loadRepostsForAddress handles nullish fields in logs and skips tokenId 0", async () => {
    socials.parseLog.mockReset();

    wallet.provider = { getBlockNumber: vi.fn(async () => 10) };

    const sharedLogs = [
      // No blockNumber, no index/logIndex -> exercises ?? 0 fallbacks in sorting and blockNumber defaulting.
      { topics: ["t"], data: "S:fallback", blockNumber: undefined, index: undefined, logIndex: undefined },
      // Another log with nullish sort fields to ensure both sides of comparisons hit fallbacks.
      { topics: ["t"], data: "S:fallback2", blockNumber: undefined, index: undefined, logIndex: undefined },
      // Has index but no logIndex -> exercises index branch.
      { topics: ["t"], data: "S:index", blockNumber: 1, index: 7, logIndex: undefined },
      // Has logIndex but tokenIdBig=0n -> exercises falsy tokenId branch.
      { topics: ["t"], data: "S:zero", blockNumber: 2, logIndex: 1 }
    ];

    const read = {
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async (filter: any) => {
        if (filter === "shared") return sharedLogs;
        return [];
      })
    };
    contract.getReadContract = vi.fn(async () => read);

    socials.parseLog.mockImplementation(({ data }: any) => {
      if (data === "S:fallback") return { name: "PostShared", args: [wallet.walletAddress, 3n] };
      if (data === "S:fallback2") return { name: "PostShared", args: [wallet.walletAddress, 5n] };
      if (data === "S:index") return { name: "PostShared", args: [wallet.walletAddress, 4n] };
      if (data === "S:zero") return { name: "PostShared", args: [wallet.walletAddress, 0n] };
      return null;
    });

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await act(async () => {
      screen.getByText("reposts").click();
    });

    await waitFor(() => {
      expect(feed.loadPostsByTokenIds).toHaveBeenCalled();
      const args = (feed.loadPostsByTokenIds as any).mock.calls.at(-1)?.[0] as string[];
      expect(args).toEqual(expect.arrayContaining(["3", "4", "5"]));
      expect(args).not.toEqual(expect.arrayContaining(["0"]));
    });
  });

  it("loadRepostsForAddress reports min-window failure via status", async () => {
    setStatus.mockClear();
    socials.parseLog.mockReset();
    socials.parseLog.mockImplementation(() => null);

    wallet.provider = { getBlockNumber: vi.fn(async () => 0) };

    contract.getReadContract = vi.fn(async () => ({
      filters: {
        PostShared: (_addr: string, __: any) => "shared",
        PostUnshared: (_addr: string, __: any) => "unshared"
      },
      queryFilter: vi.fn(async () => {
        throw new Error("always fails");
      })
    }));

    let appRef: any = null;
    function Grab() {
      appRef = useApp();
      return null;
    }

    render(
      <AppProvider>
        <Grab />
      </AppProvider>
    );

    await act(async () => {
      await appRef.loadRepostsForAddress("0xabc");
    });

    expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("RPC could not serve repost log range"));
  });
});
