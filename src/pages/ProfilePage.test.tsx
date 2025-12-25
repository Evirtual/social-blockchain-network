import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      onAdminReset: vi.fn(),
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

  it("does not show admin edit controls when owner is viewing self", () => {
    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: "0xabc",
          address: "0xabc"
        })}
      />
    );

    expect(screen.queryByRole("button", { name: "Edit Profile" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disapprove" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });

  it("allows admin edit when owner but wallet is unknown", async () => {
    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: null,
          address: "0x000000000000000000000000000000000000BEEF",
          name: "Alice"
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();
  });

  it("admin edit draft falls back when props are undefined", async () => {
    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: null,
          address: "0x000000000000000000000000000000000000BEEF",
          name: undefined,
          bio: undefined,
          avatarUrl: undefined
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

    expect((screen.getByPlaceholderText("Display name") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("Bio") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByPlaceholderText("Avatar image URL (or upload below)") as HTMLInputElement).value).toBe("");
  });

  it("shows admin controls for owner viewing another profile", () => {
    const onAdminSetPosterAllowed = vi.fn();
    const onAdminReset = vi.fn();

    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: "0xOWNER",
          address: "0x000000000000000000000000000000000000BEEF",
          isPosterAllowed: true,
          wasPosterDisapprovedEver: true,
          onAdminSetPosterAllowed,
          onAdminReset
        })}
      />
    );

    expect(screen.getByText("Flagged")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disapprove" }));
    expect(onAdminSetPosterAllowed).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onAdminReset).toHaveBeenCalledTimes(1);
  });

  it("shows Approve when poster is not allowed and calls handler", () => {
    const onAdminSetPosterAllowed = vi.fn();

    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: "0xOWNER",
          address: "0x000000000000000000000000000000000000BEEF",
          isPosterAllowed: false,
          onAdminSetPosterAllowed
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onAdminSetPosterAllowed).toHaveBeenCalledWith(true);
  });

  it("admin edit modal: save + cancel resets fields", async () => {
    const onAdminSetProfile = vi.fn();

    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: "0xOWNER",
          address: "0x000000000000000000000000000000000000BEEF",
          name: "Alice",
          bio: "Hello",
          avatarUrl: "ipfs://avatar",
          onAdminSetProfile,
          isPosterAllowed: false
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Display name"), { target: { value: "New Name" } });
    fireEvent.change(screen.getByPlaceholderText("Bio"), { target: { value: "New Bio" } });
    fireEvent.change(screen.getByPlaceholderText("Avatar image URL (or upload below)"), {
      target: { value: "https://example.com/avatar.png" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onAdminSetProfile).toHaveBeenCalledWith({
      name: "New Name",
      bio: "New Bio",
      avatarUrl: "https://example.com/avatar.png",
      avatarFile: null,
      avatarFilename: "",
      avatarDataUrl: ""
    });

    // Cancel closes and resets to initialDraft.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit profile" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit profile" });
    expect(dialog).toBeInTheDocument();
    expect((screen.getByPlaceholderText("Display name") as HTMLInputElement).value).toBe("Alice");
    expect((screen.getByPlaceholderText("Bio") as HTMLTextAreaElement).value).toBe("Hello");
    expect((screen.getByPlaceholderText("Avatar image URL (or upload below)") as HTMLInputElement).value).toBe(
      "ipfs://avatar"
    );
  });

  it("admin edit modal: Close button triggers onClose", async () => {
    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: "0xOWNER",
          address: "0x000000000000000000000000000000000000BEEF"
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit profile" });
    expect(dialog).toBeInTheDocument();

    // Click the modal header close button, not the page-level "Close" toggle.
    fireEvent.click(screen.getByLabelText("Close"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit profile" })).toBeNull();
    });
  });

  it("admin avatar file selection shows preview and saves avatarDataUrl", async () => {
    const onAdminSetProfile = vi.fn();

    const OriginalFileReader = (globalThis as any).FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        this.result = "data:image/png;base64,AAA";
        if (this.onload) this.onload();
      }
    }
    (globalThis as any).FileReader = MockFileReader;

    try {
      render(
        <ProfilePage
          {...makeProps({
            isOwner: true,
            walletAddress: "0xOWNER",
            address: "0x000000000000000000000000000000000000BEEF",
            onAdminSetProfile
          })}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
      expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

      const file = new File(["abc"], "avatar.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();

      fireEvent.change(fileInput!, { target: { files: [file] } });

      expect(await screen.findByAltText("Avatar preview")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(onAdminSetProfile).toHaveBeenCalledWith({
        name: "",
        bio: "",
        avatarUrl: "",
        avatarFile: file,
        avatarFilename: "avatar.png",
        avatarDataUrl: "data:image/png;base64,AAA"
      });
    } finally {
      (globalThis as any).FileReader = OriginalFileReader;
    }
  });

  it("admin avatar upload uses default filename when File.name is empty", async () => {
    const onAdminSetProfile = vi.fn();

    const OriginalFileReader = (globalThis as any).FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        this.result = "data:image/png;base64,AAA";
        if (this.onload) this.onload();
      }
    }
    (globalThis as any).FileReader = MockFileReader;

    try {
      render(
        <ProfilePage
          {...makeProps({
            isOwner: true,
            walletAddress: "0xOWNER",
            address: "0x000000000000000000000000000000000000BEEF",
            onAdminSetProfile
          })}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
      expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

      const file = new File(["abc"], "", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();
      fireEvent.change(fileInput!, { target: { files: [file] } });

      // Wait for FileReader state updates to land.
      expect(await screen.findByAltText("Avatar preview")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(onAdminSetProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarFilename: "avatar.png",
          avatarDataUrl: "data:image/png;base64,AAA"
        })
      );
    } finally {
      (globalThis as any).FileReader = OriginalFileReader;
    }
  });

  it("admin avatar upload handles FileReader null result", async () => {
    const onAdminSetProfile = vi.fn();

    const OriginalFileReader = (globalThis as any).FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        // Intentionally leave result as null.
        if (this.onload) this.onload();
      }
    }
    (globalThis as any).FileReader = MockFileReader;

    try {
      render(
        <ProfilePage
          {...makeProps({
            isOwner: true,
            walletAddress: "0xOWNER",
            address: "0x000000000000000000000000000000000000BEEF",
            name: "Alice",
            onAdminSetProfile
          })}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
      expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

      const file = new File(["abc"], "avatar.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();
      fireEvent.change(fileInput!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(onAdminSetProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarFile: file,
          avatarFilename: "avatar.png",
          avatarDataUrl: ""
        })
      );
    } finally {
      (globalThis as any).FileReader = OriginalFileReader;
    }
  });

  it("admin avatar file selection can be cleared by selecting no file", async () => {
    const OriginalFileReader = (globalThis as any).FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        this.result = "data:image/png;base64,AAA";
        if (this.onload) this.onload();
      }
    }
    (globalThis as any).FileReader = MockFileReader;

    try {
      render(
        <ProfilePage
          {...makeProps({
            isOwner: true,
            walletAddress: "0xOWNER",
            address: "0x000000000000000000000000000000000000BEEF"
          })}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
      expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

      const file = new File(["abc"], "avatar.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();

      fireEvent.change(fileInput!, { target: { files: [file] } });
      expect(await screen.findByAltText("Avatar preview")).toBeInTheDocument();

      fireEvent.change(fileInput!, { target: { files: [] } });
      await waitFor(() => {
        expect(screen.queryByAltText("Avatar preview")).toBeNull();
      });
    } finally {
      (globalThis as any).FileReader = OriginalFileReader;
    }
  });

  it("admin avatar file selection clears when FileReader fails", async () => {
    const OriginalFileReader = (globalThis as any).FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        if (this.onerror) this.onerror();
      }
    }
    (globalThis as any).FileReader = MockFileReader;

    try {
      const onAdminSetProfile = vi.fn();
      render(
        <ProfilePage
          {...makeProps({
            isOwner: true,
            walletAddress: "0xOWNER",
            address: "0x000000000000000000000000000000000000BEEF",
            onAdminSetProfile
          })}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
      expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

      const file = new File(["abc"], "avatar.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();

      fireEvent.change(fileInput!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.queryByAltText("Avatar preview")).toBeNull();
      });

      const save = screen.getByRole("button", { name: "Save" });
      expect(save).toBeEnabled();

      fireEvent.click(save);
      expect(onAdminSetProfile).toHaveBeenCalledWith({
        name: "",
        bio: "",
        avatarUrl: "",
        avatarFile: null,
        avatarFilename: "",
        avatarDataUrl: ""
      });
    } finally {
      (globalThis as any).FileReader = OriginalFileReader;
    }
  });

  it("admin edit modal Clear button clears avatar fields", async () => {
    const onAdminSetProfile = vi.fn();

    render(
      <ProfilePage
        {...makeProps({
          isOwner: true,
          walletAddress: "0xOWNER",
          address: "0x000000000000000000000000000000000000BEEF",
          onAdminSetProfile
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(await screen.findByRole("dialog", { name: "Edit profile" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Avatar image URL (or upload below)"), {
      target: { value: "https://example.com/avatar.png" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onAdminSetProfile).toHaveBeenCalledWith({
      name: "",
      bio: "",
      avatarUrl: "",
      avatarFile: null,
      avatarFilename: "",
      avatarDataUrl: ""
    });
  });
});
