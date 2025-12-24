import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfilePage } from "./ProfilePage";

vi.mock("../components/Feed", () => ({
  Feed: () => <div data-testid="feed" />
}));

vi.mock("../ipfs", () => ({
  ipfsToHttp: () => "http://gateway/avatar.png"
}));

describe("ProfilePage", () => {
  function makeProps(overrides: Partial<any> = {}) {
    return {
      isOwner: false,
      address: "0xabc",
      name: "",
      bio: "",
      avatarHue: 123,
      avatarUrl: "",
      onAdminSetPosterAllowed: vi.fn(),
      onAdminDeleteAll: vi.fn(),
      onAdminSetProfile: vi.fn(),
      isFollowing: undefined as boolean | undefined,
      onToggleFollow: vi.fn(),
      posts: [],
      chainId: "31337",
      status: "",
      isFeedLoading: false,
      walletAddress: "0xdef",
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
      getExplorerTxUrl: () => null,
      ...overrides
    };
  }

  it("shows follow button only when wallet is different; disables until isFollowing resolved", () => {
    render(<ProfilePage {...makeProps()} />);

    const btn = screen.getByRole("button", { name: "Follow" });
    expect(btn).toBeDisabled();
    expect(screen.getByText("No bio yet.")).toBeInTheDocument();
  });

  it("toggles follow state labels and calls handler", () => {
    const onToggleFollow = vi.fn();

    const { rerender } = render(<ProfilePage {...makeProps({ isFollowing: true, onToggleFollow })} />);
    fireEvent.click(screen.getByRole("button", { name: "Unfollow" }));
    expect(onToggleFollow).toHaveBeenCalledTimes(1);

    rerender(<ProfilePage {...makeProps({ isFollowing: false, onToggleFollow })} />);
    expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled();
  });

  it("uses avatarUrl backgroundImage when provided", () => {
    render(<ProfilePage {...makeProps({ avatarUrl: "ipfs://avatar", name: "Alice" })} />);

    const avatar = document.querySelector(".avatar") as HTMLDivElement | null;
    expect(avatar).not.toBeNull();
    expect(avatar!.getAttribute("style") ?? "").toContain("background-image");
  });

  it("does not show follow button when viewing self", () => {
    render(<ProfilePage {...makeProps({ address: "0xdef", walletAddress: "0xdef" })} />);
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unfollow" })).toBeNull();
  });
});
