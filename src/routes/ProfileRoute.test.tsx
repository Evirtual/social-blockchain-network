import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { ProfileRoute } from "./ProfileRoute";

const mocks = vi.hoisted(() => {
  return {
    app: {
      walletAddress: "0xme" as string | null,
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
      toggleFollow: vi.fn()
    }
  };
});

vi.mock("../contexts/AppContext", () => ({
  useApp: () => mocks.app
}));

vi.mock("../contexts/useContractTx", () => ({
  useContractTx: () => ({
    runContractTx: vi.fn(async (_label: string, send: () => Promise<any>) => await send())
  })
}));

vi.mock("../contexts/ContractContext", () => ({
  useContract: () => ({
    ensureContractDeployedOnCurrentNetwork: vi.fn(async () => undefined),
    getReadContract: vi.fn(async () => ({})),
    getWriteContract: vi.fn(async () => ({}))
  })
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
    <div data-testid="profile-page" data-is-following={String(props.isFollowing)}>
      <button type="button" onClick={() => props.onToggleFollow?.()}>
        toggle
      </button>
    </div>
  )
}));

describe("ProfileRoute", () => {
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
