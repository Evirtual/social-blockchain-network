import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomeRoute } from "./HomeRoute";

const mocks = vi.hoisted(() => {
  return {
    app: {
      selfAvatarHue: 1,
      ipfsConfigured: true,
      openComposer: vi.fn(),
      draft: { title: "", body: "", imageUrl: "", imageDataUrl: "" },
      isImageLoading: false,
      handleDraftChange: vi.fn(),
      onComposerImageUrlChange: vi.fn(),
      onSelectComposerFile: vi.fn(),
      onComposerClearImage: vi.fn(),
      mintPost: vi.fn(),
      posts: [],
      chainId: "31337",
      status: "",
      isFeedLoading: false,
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

vi.mock("../pages/HomePage", () => ({
  HomePage: (props: any) => <div data-testid="home-page">{String(!!props)}</div>
}));

describe("HomeRoute", () => {
  it("renders HomePage with app props", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomeRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });
});
