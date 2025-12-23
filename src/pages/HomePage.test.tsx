import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HomePage } from "./HomePage";

const feedSpy = vi.fn();
vi.mock("../components/Feed", () => ({
  Feed: (props: any) => {
    feedSpy(props);
    return (
      <div>
        <div data-testid="feed-title">{props.title}</div>
        <div data-testid="feed-pill">{props.pillText}</div>
        <div data-testid="feed-count">{props.posts?.length ?? 0}</div>
        <div data-testid="feed-action">{props.headerAction}</div>
      </div>
    );
  }
}));

describe("HomePage", () => {
  beforeEach(() => {
    feedSpy.mockClear();
    localStorage.removeItem("socialBlockchainNetwork.heroDismissed");
  });

  function makeProps(overrides: Partial<any> = {}) {
    const posts = [
      {
        tokenId: "1",
        title: "Hello",
        body: "first post",
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
        title: "World",
        body: "second post",
        image: "",
        metadataURI: "",
        author: "0xbbb",
        likes: 0,
        comments: 0,
        shares: 0,
        tipsWei: 0n
      }
    ];

    const authorIdentity = new Map<string, any>();
    authorIdentity.set("0xbbb", { name: "Bob", hue: 1 });

    return {
      selfAvatarHue: 1,
      ipfsConfigured: true,
      onOpenComposer: vi.fn(),
      draft: { title: "", body: "", imageUrl: "", imageDataUrl: "" },
      isImageLoading: false,
      onDraftFieldChange: vi.fn(),
      onImageUrlChange: vi.fn(),
      onSelectFile: vi.fn(),
      onClearImage: vi.fn(),
      onPost: vi.fn(),
      posts,
      chainId: "31337",
      status: "",
      isFeedLoading: false,
      walletAddress: null,
      authorIdentity,
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

  it("renders hero and can dismiss it (persisting to localStorage)", () => {
    render(<HomePage {...makeProps()} />);

    expect(screen.getByText(/A social blockchain network/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss intro" }));
    expect(screen.queryByText(/A social blockchain network/i)).toBeNull();
    expect(localStorage.getItem("socialBlockchainNetwork.heroDismissed")).toBe("1");
  });

  it("filters posts by search and updates pillText", () => {
    render(<HomePage {...makeProps()} />);

    expect(screen.getByTestId("feed-pill").textContent).toBe("2 posts");
    expect(screen.getByTestId("feed-count").textContent).toBe("2");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search posts or accounts" }), {
      target: { value: "bob" }
    });

    expect(screen.getByTestId("feed-pill").textContent).toBe("1 / 2 posts");
    expect(screen.getByTestId("feed-count").textContent).toBe("1");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search posts or accounts" }), {
      target: { value: "" }
    });

    expect(screen.getByTestId("feed-pill").textContent).toBe("2 posts");
  });

  it("search filtering handles posts with missing author", () => {
    render(
      <HomePage
        {...makeProps({
          posts: [
            {
              tokenId: "1",
              title: "Hello",
              body: "first post",
              image: "",
              metadataURI: "",
              author: undefined,
              likes: 0,
              comments: 0,
              shares: 0,
              tipsWei: 0n
            }
          ]
        })}
      />
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search posts or accounts" }), {
      target: { value: "zzz" }
    });

    expect(screen.getByTestId("feed-count").textContent).toBe("0");
  });

  it("shows hero when localStorage read throws", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    render(<HomePage {...makeProps()} />);
    expect(screen.getByText(/A social blockchain network/i)).toBeInTheDocument();

    getSpy.mockRestore();
  });

  it("can dismiss hero even when localStorage write throws", () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    render(<HomePage {...makeProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss intro" }));
    expect(screen.queryByText(/A social blockchain network/i)).toBeNull();

    setSpy.mockRestore();
  });
});
