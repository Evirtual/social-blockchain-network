import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AppProvider, useApp } from "./AppContext";

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
      <div data-testid="saved">{JSON.stringify(app.repostTokenIdsByAddress[(app.walletAddress ?? "").toLowerCase()] ?? [])}</div>
      <button type="button" onClick={() => app.connectWallet()}>
        connect
      </button>
      <button type="button" onClick={() => app.loadRepostsForAddress("0xabc")}>
        reposts
      </button>
    </div>
  );
}

describe("AppContext", () => {
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
      expect(screen.getByTestId("saved").textContent).toBe("[\"2\"]");
    });
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
