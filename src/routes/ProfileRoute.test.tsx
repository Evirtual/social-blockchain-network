import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { ProfileRoute } from "./ProfileRoute";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

const mocks: any = vi.hoisted(() => {
  return {
    hasPinata: false,
    pinataPinFile: vi.fn(async () => ({ IpfsHash: "QmPinned" })),
    runContractTx: vi.fn(async (_label: string, send: () => Promise<any>) => await send()),
    contract: {
      ensureContractDeployedOnCurrentNetwork: vi.fn(async () => undefined),
      getReadContract: vi.fn(async () => ({})),
      getWriteContract: vi.fn(async () => ({}))
    },
    app: {
      walletAddress: "0xme" as string | null,
      isOwner: undefined as any,
      profilesByAddress: { "0xme": { name: "Me", bio: "", avatarUrl: "" } } as any,
      isFollowingByAddress: {} as any,
      posts: [{ tokenId: "1", title: "", body: "", image: "", metadataURI: "", author: "0xme", likes: 0, comments: 0, shares: 0, tipsWei: 0n }],
      repostTokenIdsByAddress: { "0xme": ["1"] } as any,
      isLoadingRepostsByAddress: {} as any,
      followerCountByAddress: {} as any,
      followersByAddress: {} as any,
      followingByAddress: {} as any,
      isLoadingFollowersByAddress: {} as any,
      isLoadingFollowingByAddress: {} as any,
      displayName: "Me",
      profileBio: "",
      profileAvatarUrl: "",
      myPostsCount: 1,
      disconnectWallet: vi.fn(),
      isEditingProfile: false,
      profileDraftName: "",
      profileDraftBio: "",
      profileDraftAvatarUrl: "",
      profileDraftAvatarDataUrl: "",
      isProfileAvatarLoading: false,
      setProfileDraftName: vi.fn(),
      setProfileDraftBio: vi.fn(),
      setProfileDraftAvatarUrl: vi.fn(),
      onSelectProfileAvatarFile: vi.fn(),
      onClearProfileAvatar: vi.fn(),
      startEditProfile: vi.fn(),
      cancelEditProfile: vi.fn(),
      saveProfile: vi.fn(),
      selfAvatarHue: 1,
      chainId: "31337",
      networkName: "Local",
      nativeBalance: "0",
      withdrawableTipsWei: 0n,
      contractAddress: "0xcontract",
      contractDeployed: true,
      status: "",
      refreshWalletPanel: vi.fn(),
      withdrawTips: vi.fn(),
      authorIdentity: new Map(),
      isFeedLoading: false,
      editingTokenId: null,
      editDraft: { title: "", body: "", imageUrl: "", imageDataUrl: "" },
      isEditImageLoading: false,
      tipDrafts: {},
      commentDrafts: {},
      setEditDraft: vi.fn(),
      onTipDraftChange: vi.fn(),
      onCommentDraftChange: vi.fn(),
      startEditPost: vi.fn(),
      cancelEditPost: vi.fn(),
      saveEditedPost: vi.fn(),
      onEditSelectFile: vi.fn(),
      onEditClearImage: vi.fn(),
      handleAction: vi.fn(),
      handleTip: vi.fn(),
      burnPost: vi.fn(),
      freezePost: vi.fn(),
      shortAddress: (a: string) => a,
      stableHueFromSeed: () => 1,
      getNativeSymbol: () => "ETH",
      getExplorerTxUrl: () => null,
      loadProfile: vi.fn(),
      loadIsFollowing: vi.fn(),
      loadRepostsForAddress: vi.fn(),
      loadFollowerCountForAddress: vi.fn(),
      loadFollowersForAddress: vi.fn(),
      loadFollowingForAddress: vi.fn(),
      refreshFeed: vi.fn(),
      toggleFollow: vi.fn()
    }
  };
});

vi.mock("../contexts/AppContext", () => ({
  useApp: () => mocks.app
}));

vi.mock("../contexts/useContractTx", () => ({
  useContractTx: () => ({
    runContractTx: mocks.runContractTx
  })
}));

vi.mock("../contexts/ContractContext", () => ({
  useContract: () => mocks.contract
}));

vi.mock("../ipfs", () => ({
  hasPinata: () => mocks.hasPinata,
  pinataPinFile: (...args: any[]) => (mocks.pinataPinFile as any)(...args)
}));

vi.mock("../pages/AccountPage", () => ({
  AccountPage: (props: any) => (
    <div
      data-testid="account-page"
      data-posts-count={props.posts?.length ?? 0}
      data-saved-count={props.savedPosts?.length ?? 0}
    />
  )
}));

vi.mock("../pages/ProfilePage", () => ({
  ProfilePage: (props: any) => (
    <div
      data-testid="profile-page"
      data-is-following={String(props.isFollowing)}
      data-is-poster-allowed={String(props.isPosterAllowed)}
      data-was-disapproved={String(props.wasPosterDisapprovedEver)}
    >
      <button type="button" onClick={() => props.onToggleFollow?.()}>
        toggle
      </button>
      <button type="button" onClick={() => props.onAdminSetPosterAllowed?.(true)}>
        admin-approve
      </button>
      <button type="button" onClick={() => props.onAdminSetPosterAllowed?.(false)}>
        admin-disapprove
      </button>
      <button type="button" onClick={() => props.onAdminReset?.()}>
        admin-reset
      </button>
      <button
        type="button"
        onClick={() =>
          props.onAdminSetProfile?.({
            name: "  Name  ",
            bio: "  Bio  ",
            avatarUrl: "",
            avatarFile: new File(["x"], "avatar.png", { type: "image/png" }),
            avatarFilename: "avatar.png",
            avatarDataUrl: "data:image/png;base64,AAA"
          })
        }
      >
        admin-save
      </button>
      <button
        type="button"
        onClick={() =>
          props.onAdminSetProfile?.({
            name: "  Name  ",
            bio: "  Bio  ",
            avatarUrl: "",
            avatarFile: new File(["x"], "avatar.png", { type: "image/png" }),
            avatarFilename: "",
            avatarDataUrl: "data:image/png;base64,AAA"
          })
        }
      >
        admin-save-empty-filename
      </button>
      <button
        type="button"
        onClick={() =>
          props.onAdminSetProfile?.({
            name: "  Name  ",
            bio: "  Bio  ",
            avatarUrl: "",
            avatarFile: new File(["x"], "avatar.png", { type: "image/png" }),
            avatarFilename: "avatar.png",
            avatarDataUrl: ""
          })
        }
      >
        admin-save-empty-dataurl
      </button>
    </div>
  )
}));

describe("ProfileRoute", () => {
  beforeEach(() => {
    mocks.hasPinata = false;
    mocks.pinataPinFile.mockClear();

    mocks.runContractTx.mockClear();
    mocks.runContractTx.mockImplementation(async (_label: string, send: () => Promise<any>) => await send());

    mocks.contract.ensureContractDeployedOnCurrentNetwork.mockReset();
    mocks.contract.ensureContractDeployedOnCurrentNetwork.mockImplementation(async () => undefined);
    mocks.contract.getReadContract.mockReset();
    mocks.contract.getReadContract.mockImplementation(async () => ({}));
    mocks.contract.getWriteContract.mockReset();
    mocks.contract.getWriteContract.mockImplementation(async () => ({}));

    mocks.app.walletAddress = "0xme";
    (mocks.app as any).isOwner = undefined;
    mocks.app.loadProfile.mockClear();
    mocks.app.refreshFeed.mockClear();
  });

  it("does not load poster status when address is invalid (even for owner)", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    mocks.contract.ensureContractDeployedOnCurrentNetwork.mockClear();
    mocks.contract.getReadContract.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/not-an-address`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    expect(screen.getByTestId("profile-page").getAttribute("data-is-poster-allowed")).toBe("undefined");
    expect(screen.getByTestId("profile-page").getAttribute("data-was-disapproved")).toBe("undefined");

    // Let effects run a tick; the invalid-address guard should prevent any contract calls.
    await flushMicrotasks();
    expect(mocks.contract.ensureContractDeployedOnCurrentNetwork).not.toHaveBeenCalled();
    expect(mocks.contract.getReadContract).not.toHaveBeenCalled();
  });

  it("loads poster allowed/disapproved status for owner (success)", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    mocks.contract.ensureContractDeployedOnCurrentNetwork.mockClear();
    mocks.contract.getReadContract.mockResolvedValueOnce({
      isPosterAllowed: async () => true,
      wasPosterDisapproved: async () => false
    } as any);

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile-page").getAttribute("data-is-poster-allowed")).toBe("true");
      expect(screen.getByTestId("profile-page").getAttribute("data-was-disapproved")).toBe("false");
    });
  });

  it("wires admin approve/disapprove and updates state", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const setPosterAllowed = vi.fn(async () => ({}));
    mocks.contract.getWriteContract.mockResolvedValueOnce({ setPosterAllowed } as any);

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-approve").click();
    await waitFor(() => {
      expect(mocks.runContractTx).toHaveBeenCalled();
      expect(setPosterAllowed).toHaveBeenCalledWith(addr, true);
    });

    // Disapproving should set was-disapproved ever to true.
    mocks.contract.getWriteContract.mockResolvedValueOnce({ setPosterAllowed } as any);
    screen.getByText("admin-disapprove").click();
    await waitFor(() => {
      expect(setPosterAllowed).toHaveBeenCalledWith(addr, false);
      expect(screen.getByTestId("profile-page").getAttribute("data-was-disapproved")).toBe("true");
    });
  });

  it("admin approve returns early when address is invalid", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    mocks.runContractTx.mockClear();
    mocks.contract.getWriteContract.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/not-an-address`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-approve").click();

    await flushMicrotasks();
    expect(mocks.runContractTx).not.toHaveBeenCalled();
    expect(mocks.contract.getWriteContract).not.toHaveBeenCalled();
  });

  it("admin approve returns early when not owner", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = false as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    mocks.runContractTx.mockClear();
    mocks.contract.getWriteContract.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-approve").click();

    await flushMicrotasks();
    expect(mocks.runContractTx).not.toHaveBeenCalled();
    expect(mocks.contract.getWriteContract).not.toHaveBeenCalled();
  });

  it("admin reset calls adminResetAccount with unique minted posts and refreshes feed", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false,
      runner: { provider: { getBlockNumber: async () => 3 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => [{ args: [addr, 1n] }, { args: [addr, 2n] }, { args: [addr, 2n] }])
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    mocks.app.loadProfile.mockClear();
    mocks.app.refreshFeed.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalledWith(addr, [1n, 2n]);
      expect(mocks.app.loadProfile).toHaveBeenCalledWith(addr);
      expect(mocks.app.refreshFeed).toHaveBeenCalledTimes(1);
    });
  });

  it("admin reset skips non-bigint tokenIds from logs", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false,
      runner: { provider: { getBlockNumber: async () => 3 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => [{ args: [addr, 1] }, { args: [addr, 2n] }, { args: [addr, 2n] }])
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    mocks.app.refreshFeed.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalledWith(addr, [2n]);
      expect(mocks.app.refreshFeed).toHaveBeenCalledTimes(1);
    });
  });

  it("admin reset returns early when not owner", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = false as any;

    const addr = "0x000000000000000000000000000000000000BEEF";

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();
    await waitFor(() => {
      expect(mocks.runContractTx).not.toHaveBeenCalled();
    });
  });

  it("admin reset returns early when address is invalid", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    render(
      <MemoryRouter initialEntries={[`/profile/not-an-address`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();
    await waitFor(() => {
      expect(mocks.runContractTx).not.toHaveBeenCalled();
    });
  });

  it("admin reset stops when reset tx fails", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => {
      throw new Error("fail");
    });
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalled();
      expect(mocks.app.refreshFeed).not.toHaveBeenCalled();
    });
  });

  it("admin reset continues when PostMinted query fails (still refreshes feed)", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false,
      runner: { provider: { getBlockNumber: async () => 3 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => {
        throw new Error("nope");
      })
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    mocks.app.refreshFeed.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalledWith(addr, []);
      expect(mocks.app.refreshFeed).toHaveBeenCalledTimes(1);
    });
  });

  it("admin reset ignores token discovery failure and continues", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      runner: { provider: { getBlockNumber: async () => 0 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => {
        throw new Error("fail");
      })
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    mocks.app.refreshFeed.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalledWith(addr, []);
      expect(mocks.app.refreshFeed).toHaveBeenCalledTimes(1);
    });
  });

  it("admin reset ignores loadProfile failure and continues", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      runner: { provider: { getBlockNumber: async () => 0 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => [])
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    // ProfileRoute calls loadProfile on mount; we want the reset-path call to fail.
    mocks.app.loadProfile.mockResolvedValueOnce(undefined);
    mocks.app.loadProfile.mockRejectedValueOnce(new Error("fail"));
    mocks.app.refreshFeed.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(mocks.app.refreshFeed).toHaveBeenCalledTimes(1);
    });
  });

  it("admin reset ignores refreshFeed failure", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      runner: { provider: { getBlockNumber: async () => 0 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => [])
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    mocks.app.refreshFeed.mockImplementationOnce(async () => {
      throw new Error("fail");
    });

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalledWith(addr, []);
    });
  });

  it("admin reset burns discovered tokenIds in a single call", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      runner: { provider: { getBlockNumber: async () => 1 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => [{ args: [addr, 1n] }])
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    mocks.app.refreshFeed.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalledWith(addr, [1n]);
      expect(mocks.app.refreshFeed).toHaveBeenCalledTimes(1);
    });
  });

  it("admin set profile pins to IPFS when Pinata is configured", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;
    mocks.hasPinata = true;
    mocks.pinataPinFile.mockResolvedValueOnce({ IpfsHash: "QmHash" });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminSetProfile = vi.fn(async () => ({}));
    mocks.contract.getWriteContract.mockResolvedValueOnce({ adminSetProfile } as any);
    mocks.app.loadProfile.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-save").click();

    await waitFor(() => {
      expect(mocks.pinataPinFile).toHaveBeenCalled();
      expect(adminSetProfile).toHaveBeenCalledWith(addr, "Name", "Bio", "ipfs://QmHash");
      expect(mocks.app.loadProfile).toHaveBeenCalledWith(addr);
    });
  });

  it("admin set profile uses default filename when avatarFilename is empty", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;
    mocks.hasPinata = true;
    mocks.pinataPinFile.mockResolvedValueOnce({ IpfsHash: "QmHash" });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminSetProfile = vi.fn(async () => ({}));
    mocks.contract.getWriteContract.mockResolvedValueOnce({ adminSetProfile } as any);

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-save-empty-filename").click();

    await waitFor(() => {
      expect(mocks.pinataPinFile).toHaveBeenCalledWith(expect.any(File), "avatar.png");
      expect(adminSetProfile).toHaveBeenCalledWith(addr, "Name", "Bio", "ipfs://QmHash");
    });
  });

  it("admin set profile falls back to avatarDataUrl when Pinata is not configured", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;
    mocks.hasPinata = false;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminSetProfile = vi.fn(async () => ({}));
    mocks.contract.getWriteContract.mockResolvedValueOnce({ adminSetProfile } as any);

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-save").click();

    await waitFor(() => {
      expect(adminSetProfile).toHaveBeenCalledWith(addr, "Name", "Bio", "data:image/png;base64,AAA");
    });
  });

  it("admin set profile falls back to empty avatar string when avatarDataUrl is empty", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;
    mocks.hasPinata = false;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminSetProfile = vi.fn(async () => ({}));
    mocks.contract.getWriteContract.mockResolvedValueOnce({ adminSetProfile } as any);

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-save-empty-dataurl").click();

    await waitFor(() => {
      expect(adminSetProfile).toHaveBeenCalledWith(addr, "Name", "Bio", "");
    });
  });

  it("admin reset uses latest=0 when provider has no getBlockNumber", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const queryFilter = vi.fn(async () => []);
    const readContract: any = {
      runner: {},
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(queryFilter).toHaveBeenCalledWith(expect.anything(), 0, 0);
    });
  });

  it("admin reset trims the address before sending txs", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      runner: { provider: { getBlockNumber: async () => 0 } },
      filters: { PostMinted: (a: string) => ({ addr: a }) },
      queryFilter: vi.fn(async () => [])
    };
    mocks.contract.getReadContract.mockResolvedValue(readContract);
    mocks.contract.getWriteContract.mockResolvedValue({ adminResetAccount } as any);

    // Encode spaces around the address; react-router params decode them.
    render(
      <MemoryRouter initialEntries={[`/profile/%20${addr}%20`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-reset").click();

    await waitFor(() => {
      expect(adminResetAccount).toHaveBeenCalledWith(addr, []);
    });
  });

  it("admin set profile returns early when not owner", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = false as any;
    mocks.hasPinata = true;

    const addr = "0x000000000000000000000000000000000000BEEF";
    mocks.runContractTx.mockClear();
    mocks.contract.getWriteContract.mockClear();
    mocks.pinataPinFile.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-save").click();

    await flushMicrotasks();
    expect(mocks.runContractTx).not.toHaveBeenCalled();
    expect(mocks.contract.getWriteContract).not.toHaveBeenCalled();
    expect(mocks.pinataPinFile).not.toHaveBeenCalled();
  });

  it("owner-status effect stops updates after unmount (success path)", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    let resolveAllowed: any = null;

    const readContract: any = {
      isPosterAllowed: vi.fn(
        () =>
          new Promise<boolean>((r) => {
            resolveAllowed = r;
          })
      ),
      wasPosterDisapproved: vi.fn(async () => false)
    };
    mocks.contract.ensureContractDeployedOnCurrentNetwork.mockResolvedValueOnce(undefined);
    mocks.contract.getReadContract.mockResolvedValue(readContract);

    const { unmount } = render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    // Ensure the effect has started and captured the resolver before unmount.
    for (let i = 0; i < 20 && !resolveAllowed; i++) {
      await flushMicrotasks();
    }
    expect(typeof resolveAllowed).toBe("function");

    unmount();
    if (resolveAllowed) resolveAllowed(true);

    await flushMicrotasks();
  });

  it("admin set profile returns early when address is invalid", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;
    mocks.hasPinata = true;

    mocks.runContractTx.mockClear();
    mocks.contract.getWriteContract.mockClear();
    mocks.pinataPinFile.mockClear();

    render(
      <MemoryRouter initialEntries={[`/profile/not-an-address`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("admin-save").click();

    await flushMicrotasks();
    expect(mocks.runContractTx).not.toHaveBeenCalled();
    expect(mocks.contract.getWriteContract).not.toHaveBeenCalled();
    expect(mocks.pinataPinFile).not.toHaveBeenCalled();
  });

  it("owner-status effect stops updates after unmount (error path)", async () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.isOwner = true as any;

    const addr = "0x000000000000000000000000000000000000BEEF";
    mocks.contract.ensureContractDeployedOnCurrentNetwork.mockRejectedValueOnce(new Error("fail"));

    const { unmount } = render(
      <MemoryRouter initialEntries={[`/profile/${addr}`]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    unmount();
    await flushMicrotasks();
  });

  it("navigates to / when address missing", () => {
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/profile" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("renders AccountPage for self and triggers self-only loads", () => {
    mocks.app.loadProfile.mockClear();
    mocks.app.loadIsFollowing.mockClear();
    mocks.app.loadRepostsForAddress.mockClear();

    render(
      <MemoryRouter initialEntries={["/profile/0xme"]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("account-page")).toBeInTheDocument();
    expect(mocks.app.loadProfile).toHaveBeenCalledWith("0xme");
    expect(mocks.app.loadRepostsForAddress).toHaveBeenCalledWith("0xme");
    expect(mocks.app.loadIsFollowing).not.toHaveBeenCalled();

    expect(mocks.app.loadFollowerCountForAddress).toHaveBeenCalledWith("0xme");
    expect(mocks.app.loadFollowersForAddress).toHaveBeenCalledWith("0xme");
    expect(mocks.app.loadFollowingForAddress).toHaveBeenCalledWith("0xme");
  });

  it("renders ProfilePage for other users and triggers follow-load", () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.loadProfile.mockClear();
    mocks.app.loadIsFollowing.mockClear();

    render(
      <MemoryRouter initialEntries={["/profile/0xother"]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    expect(mocks.app.loadProfile).toHaveBeenCalledWith("0xother");
    expect(mocks.app.loadIsFollowing).toHaveBeenCalledWith("0xother");
  });

  it("does not try to load follow state when wallet is disconnected", () => {
    mocks.app.walletAddress = null;
    mocks.app.loadIsFollowing.mockClear();

    render(
      <MemoryRouter initialEntries={["/profile/0xother"]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    expect(mocks.app.loadIsFollowing).not.toHaveBeenCalled();
  });

  it("wires onToggleFollow to toggleFollow(address)", () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.toggleFollow.mockClear();

    render(
      <MemoryRouter initialEntries={["/profile/0xother"]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    screen.getByText("toggle").click();
    expect(mocks.app.toggleFollow).toHaveBeenCalledWith("0xother");
  });

  it("filters savedPosts to only those present in the feed", () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.repostTokenIdsByAddress = { "0xme": ["999"] } as any;

    render(
      <MemoryRouter initialEntries={["/profile/0xme"]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    const node = screen.getByTestId("account-page");
    expect(node.getAttribute("data-posts-count")).toBe("1");
    expect(node.getAttribute("data-saved-count")).toBe("0");
  });

  it("treats missing repost list as empty", () => {
    mocks.app.walletAddress = "0xme";
    mocks.app.repostTokenIdsByAddress = {} as any;

    render(
      <MemoryRouter initialEntries={["/profile/0xme"]}>
        <Routes>
          <Route path="/profile/:address" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    const node = screen.getByTestId("account-page");
    expect(node.getAttribute("data-saved-count")).toBe("0");
  });
});
