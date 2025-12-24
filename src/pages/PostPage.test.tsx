import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PostPage } from "./PostPage";

vi.mock("../components/Feed", () => ({
  Feed: () => <div data-testid="feed" />
}));

describe("PostPage", () => {
  function makeProps(overrides: Partial<any> = {}) {
    return {
      isOwner: false,
      tokenId: "1",
      post: {
        tokenId: "1",
        title: "t",
        body: "b",
        image: "",
        metadataURI: "",
        author: "0xaaa",
        likes: 0,
        comments: 0,
        shares: 0,
        tipsWei: 0n
      },
      comments: [
        { commenter: "0xabc", comment: "hi", txHash: "0xtx" },
        { commenter: "0xdef", comment: "no tx" }
      ],
      isLoadingComments: false,
      posts: [],
      chainId: "31337",
      walletAddress: "0xaaa",
      authorIdentity: new Map(),
      editingTokenId: null,
      editDraft: { title: "", body: "", imageUrl: "", imageDataUrl: "" },
      isEditImageLoading: false,
      tipDrafts: {},
      commentDrafts: { "1": "draft" },
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
      getExplorerTxUrl: () => "https://explorer/tx",
      ...overrides
    };
  }

  it("uses safeFrom when coming from non-post route", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/post/1", state: { from: "/profile/0xabc" } }]}>
        <PostPage {...makeProps()} />
      </MemoryRouter>
    );

    const back = screen.getByRole("link", { name: "← Home" });
    expect(back.getAttribute("href") ?? "").toContain("/profile/0xabc");
  });

  it("sanitizes from when it points to another post", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/post/1", state: { from: "/post/2" } }]}>
        <PostPage {...makeProps()} />
      </MemoryRouter>
    );

    const back = screen.getByRole("link", { name: "← Home" });
    expect(back.getAttribute("href") ?? "").toContain("/");
  });

  it("wires comment input and renders tx links", () => {
    const onCommentDraftChange = vi.fn();
    const onAction = vi.fn();

    render(
      <MemoryRouter initialEntries={[{ pathname: "/post/1" }]}>
        <PostPage {...makeProps({ onCommentDraftChange, onAction })} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Write a comment to sign"), { target: { value: "next" } });
    expect(onCommentDraftChange).toHaveBeenCalledWith("1", "next");

    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    expect(onAction).toHaveBeenCalledWith("1", "comment");

    // only the first comment should have a tx link
    const links = screen.getAllByRole("link");
    expect(links.some((l) => (l.getAttribute("href") ?? "").includes("explorer/tx"))).toBe(true);
  });

  it("shows not-found message when post is null", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/post/1" }]}>
        <PostPage {...makeProps({ post: null })} />
      </MemoryRouter>
    );

    expect(screen.getByText("Post not found on the current feed.")).toBeInTheDocument();
  });

  it("shows loading message when loading comments with none yet", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/post/1" }]}>
        <PostPage {...makeProps({ comments: [], isLoadingComments: true })} />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading comments…")).toBeInTheDocument();
  });

  it("shows empty message when not loading and no comments", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/post/1" }]}>
        <PostPage {...makeProps({ comments: [], isLoadingComments: false })} />
      </MemoryRouter>
    );

    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders empty comment draft when none exists", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/post/1" }]}>
        <PostPage {...makeProps({ commentDrafts: {} })} />
      </MemoryRouter>
    );

    expect((screen.getByPlaceholderText("Write a comment to sign") as HTMLInputElement).value).toBe("");
  });
});
