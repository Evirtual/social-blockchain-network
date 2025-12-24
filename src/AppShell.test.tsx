import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./AppShell";

const mocks = vi.hoisted(() => {
  return {
    app: {
      theme: "dark" as const,
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      toggleTheme: vi.fn(),
      connectWallet: vi.fn(),
      openComposer: vi.fn(),
      closeComposer: vi.fn(),
      isComposerOpen: true,
      profileLink: "/profile/0x123",
      shortAddress: (addr: string) => addr.slice(0, 6) + "…" + addr.slice(-4),
      selfAvatarHue: 42,
      ipfsConfigured: true,
      draft: { body: "", imageUrl: "", imageDataUrl: "", mimeType: "" },
      isImageLoading: false,
      handleDraftChange: vi.fn(),
      onComposerImageUrlChange: vi.fn(),
      onSelectComposerFile: vi.fn(),
      onComposerClearImage: vi.fn(),
      mintPost: vi.fn(),

      approvalRequired: false,
      approvalRequested: false,
      requestApproval: vi.fn(),
      dismissApproval: vi.fn()
    }
  };
});

vi.mock("./contexts/AppContext", () => ({
  useApp: () => mocks.app
}));

vi.mock("./components/Topbar", () => ({
  Topbar: (props: any) => <div data-testid="topbar">{props.rightSlot}</div>
}));

vi.mock("./components/Modal", () => ({
  Modal: (props: any) => (props.open ? <div data-testid="modal">{props.children}</div> : null)
}));

vi.mock("./components/ComposerCard", () => ({
  ComposerCard: (props: any) => (
    <div data-testid="composer">
      <button type="button" onClick={props.onPost}>
        post
      </button>
    </div>
  )
}));

vi.mock("./components/TxToaster", () => ({
  TxToaster: () => <div data-testid="toaster" />
}));

vi.mock("./routes/HomeRoute", () => ({
  HomeRoute: () => <div>home</div>
}));
vi.mock("./routes/PostRoute", () => ({
  PostRoute: () => <div>post</div>
}));
vi.mock("./routes/ProfileRoute", () => ({
  ProfileRoute: () => <div>profile</div>
}));

describe("AppShell", () => {
  beforeEach(() => {
    mocks.app.profileLink = "/profile/0x123";
    mocks.app.isComposerOpen = true;
  });

  it("renders topbar slot, composer modal, and toaster", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell />
      </MemoryRouter>
    );

    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", mocks.app.profileLink);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByTestId("composer")).toBeInTheDocument();

    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("renders no profile link when profileLink is null", () => {
    mocks.app.profileLink = null as any;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell />
      </MemoryRouter>
    );

    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders an empty profile label when walletAddress is null", () => {
    mocks.app.profileLink = "/profile/0x123";
    mocks.app.walletAddress = null as any;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell />
      </MemoryRouter>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", mocks.app.profileLink);
    expect(link).toBeEmptyDOMElement();
  });

  it("does not render composer modal when closed", () => {
    mocks.app.profileLink = "/profile/0x123";
    mocks.app.isComposerOpen = false;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("modal")).toBeNull();
    expect(screen.queryByTestId("composer")).toBeNull();
  });
});
