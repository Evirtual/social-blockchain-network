import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PostRoute } from "./PostRoute";

const mocks = vi.hoisted(() => {
  return {
    loadCommentsForPost: vi.fn(),
    app: {
      loadCommentsForPost: vi.fn(),
      posts: [{ tokenId: "123", title: "t", body: "b", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }],
      postComments: { "123": [] as any[] },
      isLoadingPostComments: {} as Record<string, boolean>,
      chainId: "31337",
      walletAddress: null,
      authorIdentity: new Map(),
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
      getExplorerTxUrl: () => null
    }
  };
});

vi.mock("../contexts/AppContext", () => ({
  useApp: () => mocks.app
}));

vi.mock("../pages/PostPage", () => ({
  PostPage: (props: any) => (
    <div data-testid="post-page" data-has-post={props.post ? "yes" : "no"}>
      {props.tokenId}
    </div>
  )
}));

describe("PostRoute", () => {
  it("renders missing tokenId message when route has no param", () => {
    render(
      <MemoryRouter initialEntries={["/post"]}>
        <Routes>
          <Route path="/post" element={<PostRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Missing token id.")).toBeInTheDocument();
  });

  it("loads comments and renders PostPage when tokenId present", async () => {
    mocks.app.loadCommentsForPost.mockClear();

    render(
      <MemoryRouter initialEntries={["/post/123"]}>
        <Routes>
          <Route path="/post/:tokenId" element={<PostRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("post-page").textContent).toBe("123");
    expect(screen.getByTestId("post-page")).toHaveAttribute("data-has-post", "yes");
    expect(mocks.app.loadCommentsForPost).toHaveBeenCalledWith("123");
  });

  it("renders PostPage with null post when tokenId not in feed", () => {
    mocks.app.loadCommentsForPost.mockClear();

    render(
      <MemoryRouter initialEntries={["/post/999"]}>
        <Routes>
          <Route path="/post/:tokenId" element={<PostRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("post-page").textContent).toBe("999");
    expect(screen.getByTestId("post-page")).toHaveAttribute("data-has-post", "no");
    expect(mocks.app.loadCommentsForPost).toHaveBeenCalledWith("999");
  });
});
