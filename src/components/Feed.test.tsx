import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Feed } from "./Feed";

const postCardSpy = vi.fn();
vi.mock("./PostCard", () => ({
  PostCard: (props: any) => {
    postCardSpy(props);
    return (
      <div data-testid={`post-${props.post.tokenId}`}>
        <div>{props.authorLabel}</div>
        <div>{String(props.isMine)}</div>
        <div>{props.from}</div>
      </div>
    );
  }
}));

describe("Feed", () => {
  function makeProps(overrides: Partial<any> = {}) {
    return {
      posts: [
        {
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
        {
          tokenId: "2",
          title: "t",
          body: "b",
          image: "",
          metadataURI: "",
          author: "0xbbb",
          likes: 0,
          comments: 0,
          shares: 0,
          tipsWei: 0n
        }
      ],
      chainId: "31337",
      walletAddress: "0xaaa",
      authorIdentity: new Map<string, any>([["0xbbb", { name: "Bob", hue: 10 }]]),
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
      stableHueFromSeed: () => 7,
      getNativeSymbol: () => "ETH",
      getExplorerTxUrl: () => null,
      ...overrides
    };
  }

  it("renders default header and default pill", () => {
    postCardSpy.mockClear();

    render(
      <MemoryRouter initialEntries={[{ pathname: "/", state: { from: "/x" } }]}>
        <Feed {...makeProps({ title: undefined, pillText: undefined })} />
      </MemoryRouter>
    );

    expect(screen.getByText("Chain Feed")).toBeInTheDocument();
    expect(screen.getByText("2 minted posts")).toBeInTheDocument();
    expect(screen.getByTestId("post-1")).toBeInTheDocument();
  });

  it("renders a custom pillText when provided", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Feed {...makeProps({ pillText: "My pill" })} />
      </MemoryRouter>
    );

    expect(screen.getByText("My pill")).toBeInTheDocument();
  });

  it("hides pill when pillText is empty string and can hide header", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Feed {...makeProps({ pillText: "", hideHeader: false })} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/minted posts/)).toBeNull();
  });

  it("can hide the header entirely", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Feed {...makeProps({ hideHeader: true })} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Chain Feed")).toBeNull();
    expect(screen.getByTestId("post-1")).toBeInTheDocument();
  });

  it("renders headerAction and uses from fallback when location.state is missing", () => {
    postCardSpy.mockClear();

    render(
      <MemoryRouter initialEntries={["/feed?q=1"]}>
        <Feed
          {...makeProps({
            headerAction: <button type="button">Action</button>,
            singleColumn: true
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(document.querySelector(".postsSingle")).toBeTruthy();

    const calls = postCardSpy.mock.calls.map((c) => c[0]);
    expect(calls[0].from).toBe("/feed?q=1");
  });

  it("shows loading skeletons when isLoading and no posts", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Feed {...makeProps({ isLoading: true, posts: [] })} />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Loading posts")).toBeInTheDocument();
  });

  it("does not show skeletons when posts already exist", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Feed {...makeProps({ isLoading: true })} />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText("Loading posts")).toBeNull();
  });

  it("computes authorLabel from identity or shortAddress and isMine", () => {
    postCardSpy.mockClear();

    render(
      <MemoryRouter initialEntries={[{ pathname: "/", state: { from: "/home" } }]}>
        <Feed {...makeProps()} />
      </MemoryRouter>
    );

    const calls = postCardSpy.mock.calls.map((c) => c[0]);
    const c1 = calls.find((c) => c.post.tokenId === "1");
    const c2 = calls.find((c) => c.post.tokenId === "2");

    expect(c1.authorLabel).toContain("0xaaa".slice(0, 6));
    expect(c1.isMine).toBe(true);
    expect(c1.from).toBe("/home");

    expect(c2.authorLabel).toBe("Bob");
    expect(c2.isMine).toBe(false);
  });

  it("falls back to Unknown when post author is missing", () => {
    postCardSpy.mockClear();

    const stableHueFromSeed = vi.fn(() => 99);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Feed
          {...makeProps({
            stableHueFromSeed,
            posts: [
              {
                tokenId: "1",
                title: "t",
                body: "b",
                image: "",
                metadataURI: "",
                author: undefined,
                likes: 0,
                comments: 0,
                shares: 0,
                tipsWei: 0n
              }
            ],
            walletAddress: "0xaaa"
          })}
        />
      </MemoryRouter>
    );

    const calls = postCardSpy.mock.calls.map((c) => c[0]);
    expect(calls[0].authorLabel).toBe("Unknown");
    expect(calls[0].isMine).toBe(false);
    expect(stableHueFromSeed).toHaveBeenCalledWith("guest");
  });

  it("wires onTogglePanel callback for each PostCard", async () => {
    postCardSpy.mockClear();

    render(
      <MemoryRouter initialEntries={[{ pathname: "/", state: { from: "/home" } }]}>
        <Feed {...makeProps()} />
      </MemoryRouter>
    );

    const firstProps = postCardSpy.mock.calls.map((c) => c[0]).find((c) => c.post.tokenId === "1");
    expect(firstProps?.openPanel).toBe(null);

    await act(async () => {
      firstProps.onTogglePanel("comment");
    });

    const updated = postCardSpy.mock.calls
      .map((c) => c[0])
      .filter((c) => c.post.tokenId === "1")
      .at(-1);
    expect(updated?.openPanel).toBe("comment");
  });
});
