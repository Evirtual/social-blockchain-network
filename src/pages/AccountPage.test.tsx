import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AccountPage } from "./AccountPage";

const feedSpy = vi.fn();
vi.mock("../components/Feed", () => ({
  Feed: (props: any) => {
    feedSpy(props);
    return (
      <div>
        <div data-testid="feed-title">{props.title}</div>
        <div data-testid="feed-pill">{props.pillText}</div>
        <div data-testid="feed-tag">{props.posts?.[0]?.contextTag ?? ""}</div>
        <div data-testid="feed-action">{props.headerAction}</div>
      </div>
    );
  }
}));

vi.mock("../components/Sidebar", () => ({
  Sidebar: () => null,
  ProfileCard: () => <div data-testid="profile-card" />,
  WalletCard: () => <div data-testid="wallet-card" />
}));

describe("AccountPage", () => {
  it("switches between all, saved, and liked view", () => {
    feedSpy.mockClear();

    const props: any = {
      sidebar: {
        walletAddress: "0xabc",
        displayName: "Me",
        profileBio: "",
        profileAvatarUrl: "",
        myPostsCount: 2,
        followerCount: 0,
        followers: [],
        following: [],
        isLoadingFollowers: false,
        isLoadingFollowing: false,
        onDisconnectWallet: vi.fn(),
        isEditingProfile: false,
        profileDraftName: "",
        profileDraftBio: "",
        profileDraftAvatarUrl: "",
        profileDraftAvatarDataUrl: "",
        isProfileAvatarLoading: false,
        onProfileDraftNameChange: vi.fn(),
        onProfileDraftBioChange: vi.fn(),
        onProfileDraftAvatarUrlChange: vi.fn(),
        onSelectProfileAvatarFile: vi.fn(),
        onClearProfileAvatar: vi.fn(),
        onStartEditProfile: vi.fn(),
        onCancelEditProfile: vi.fn(),
        onSaveProfile: vi.fn(),
        selfAvatarHue: 1,
        chainId: "31337",
        networkName: "Local",
        nativeBalance: "0",
        withdrawableTipsWei: 0n,
        contractAddress: "0xcontract",
        contractDeployed: true,
        status: "",
        onRefreshWalletPanel: vi.fn(),
        onWithdrawTips: vi.fn(),
        shortAddress: (a: string) => a.slice(0, 6) + "…",
        getNativeSymbol: () => "ETH"
      },
      status: "",
      isFeedLoading: false,
      posts: [
        { tokenId: "1", title: "t", body: "b", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }
      ],
      savedPosts: [
        { tokenId: "2", title: "t", body: "b", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }
      ],
      likedPosts: [
        { tokenId: "3", title: "t", body: "b", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }
      ],
      isLoadingSaved: false,
      isLoadingLiked: false,
      chainId: "31337",
      walletAddress: "0xabc",
      authorIdentity: new Map(),
      editingTokenId: null,
      editDraft: { title: "", body: "", imageUrl: "", imageDataUrl: "" },
      isEditImageLoading: false,
      tipDrafts: {},
      commentDrafts: {},
      onSetEditDraft: vi.fn(),
      onTipDraftChange: vi.fn(),
      onCommentDraftChange: vi.fn(),
      onStartEditPost: vi.fn(),
      onCancelEditPost: vi.fn(),
      onSaveEditedPost: vi.fn(),
      onEditSelectFile: vi.fn(),
      onEditClearImage: vi.fn(),
      onAction: vi.fn(),
      onTip: vi.fn(),
      onBurn: vi.fn(),
      onFreezePost: vi.fn(),
      shortAddress: (a: string) => a.slice(0, 6) + "…",
      stableHueFromSeed: () => 1,
      getNativeSymbol: () => "ETH",
      getExplorerTxUrl: () => null
    };

    render(<AccountPage {...props} />);

    expect(screen.getByTestId("feed-title").textContent).toBe("Your posts");
    expect(screen.getByTestId("feed-pill").textContent).toBe("");

    // click Saved via headerAction rendered by the mocked Feed
    fireEvent.click(screen.getByRole("button", { name: "Saved (1)" }));

    expect(screen.getByTestId("feed-title").textContent).toBe("Your posts");
    expect(screen.getByTestId("feed-pill").textContent).toBe("");
    expect(screen.getByTestId("feed-tag").textContent).toBe("saved");

    fireEvent.click(screen.getByRole("button", { name: "Posted (1)" }));
    expect(screen.getByTestId("feed-title").textContent).toBe("Your posts");

    fireEvent.click(screen.getByRole("button", { name: "Liked (1)" }));
    expect(screen.getByTestId("feed-title").textContent).toBe("Your posts");
    expect(screen.getByTestId("feed-pill").textContent).toBe("");
    expect(screen.getByTestId("feed-tag").textContent).toBe("liked");
  });
});
