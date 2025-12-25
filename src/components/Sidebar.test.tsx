import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let ProfileCard: typeof import("./Sidebar").ProfileCard;
let Sidebar: typeof import("./Sidebar").Sidebar;
let WalletCard: typeof import("./Sidebar").WalletCard;

const loadProfileMock = vi.fn(async () => undefined);

const ensureContractDeployedOnCurrentNetworkMock = vi.fn(async () => undefined);
const getReadContractMock = vi.fn(async () => ({ owner: async () => "0xOWNER" }));
const getWriteContractMock = vi.fn(async () => ({} as any));

// Important: keep mocked hook return values referentially stable.
// If we return a new object on every render, React effects that depend on that
// object will re-run every render and can create update loops (and cleanup hangs).
const appApi = {
  loadProfile: loadProfileMock,
  profilesByAddress: {
    "0xaaa": { name: "A", bio: "", avatarUrl: "ipfs://avatar" },
    "0xccc": { name: "C", bio: "", avatarUrl: "ipfs://avatar2" }
  },
  stableHueFromSeed: (seed: string) => (seed.length * 13) % 360
};

const contractApi = {
  getReadContract: (...args: any[]) => (getReadContractMock as any)(...args),
  getWriteContract: (...args: any[]) => (getWriteContractMock as any)(...args),
  ensureContractDeployedOnCurrentNetwork: (...args: any[]) =>
    (ensureContractDeployedOnCurrentNetworkMock as any)(...args)
};

const contractTxApi = {
  runContractTx: async (_label: string, send: () => Promise<any>) => {
    await send();
    return undefined;
  }
};

vi.mock("../contexts/AppContext", () => {
  return {
    useApp: () => appApi
  };
});

vi.mock("../contexts/ContractContext", () => {
  return {
    useContract: () => contractApi
  };
});

vi.mock("../contexts/useContractTx", () => {
  return {
    useContractTx: () => contractTxApi
  };
});

function setMatchMedia({ matches, modern }: { matches: boolean; modern: boolean }) {
  const listeners = new Set<(ev?: any) => void>();

  (window as any).matchMedia = vi.fn().mockImplementation(() => {
    const mq: any = {
      matches,
      media: "(max-width: 32.5rem)",
      onchange: null
    };

    if (modern) {
      mq.addEventListener = (_: string, cb: (ev?: any) => void) => listeners.add(cb);
      mq.removeEventListener = (_: string, cb: (ev?: any) => void) => listeners.delete(cb);
    } else {
      mq.addListener = (cb: (ev?: any) => void) => listeners.add(cb);
      mq.removeListener = (cb: (ev?: any) => void) => listeners.delete(cb);
    }

    mq.__setMatches = (next: boolean) => {
      matches = next;
      mq.matches = next;
      for (const cb of Array.from(listeners)) cb({ matches: next });
    };

    return mq;
  });

  return {
    setMatches(next: boolean) {
      const mq = (window.matchMedia as any).mock.results[0]?.value;
      if (mq?.__setMatches) mq.__setMatches(next);
    }
  };
}

async function flushMicrotasks(n = 5) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

async function waitForUi(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (predicate()) return;
    } catch {
      // ignore
    }

    const isFake = (vi as any).isFakeTimers?.() === true;
    if (isFake) {
      (vi as any).advanceTimersByTime?.(1);
      await flushMicrotasks(1);
    } else {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  throw new Error("Timed out waiting for UI");
}

describe("Sidebar/ProfileCard/WalletCard", () => {
  beforeAll(async () => {
    // When running the full test suite, another test file may have already
    // imported "./Sidebar" in the same worker before this file's mocks apply.
    // Resetting modules here ensures our `vi.mock(...)` hooks are honored.
    vi.resetModules();
    ({ ProfileCard, Sidebar, WalletCard } = await import("./Sidebar"));
  });

  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    getReadContractMock.mockReset();
    getWriteContractMock.mockReset();
    ensureContractDeployedOnCurrentNetworkMock.mockClear();
    loadProfileMock.mockClear();

    // Restore sensible defaults after mockReset so subsequent calls don't return undefined.
    getReadContractMock.mockImplementation(async () => ({ owner: async () => "0xOWNER" }));
    getWriteContractMock.mockImplementation(async () => ({} as any));
  });

  it("owner can open Approvals and add/validate pending wallets", async () => {
    setMatchMedia({ matches: false, modern: true });

    localStorage.removeItem("pendingPosterApprovals");
    getReadContractMock.mockResolvedValueOnce({ owner: async () => "0xOWNER" });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    // Wait for the async owner() effect to set isOwner and render the button.
    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));

    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));
    expect(screen.getByRole("dialog", { name: "Approvals" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("0x... wallet address"), {
      target: { value: "not-an-address" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Invalid address")).toBeTruthy();

    const addr = "0x000000000000000000000000000000000000BEEF";
    fireEvent.change(screen.getByPlaceholderText("0x... wallet address"), {
      target: { value: addr }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(localStorage.getItem("pendingPosterApprovals") ?? "").toContain("BEEF");
    expect(screen.getByText("0x0000")).toBeTruthy();

    // Duplicate
    fireEvent.change(screen.getByPlaceholderText("0x... wallet address"), {
      target: { value: addr }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Already in list")).toBeTruthy();
  });

  it("does not show Approvals when wallet is disconnected", async () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress={undefined as any}
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Approvals" })).toBeNull();
  });

  it("hides Approvals when owner() read fails", async () => {
    setMatchMedia({ matches: false, modern: true });

    getReadContractMock.mockResolvedValueOnce({
      owner: async () => {
        throw new Error("fail");
      }
    });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => screen.queryByRole("button", { name: "Approvals" }) === null);
  });

  it("Approvals: ignores pending approvals when localStorage JSON is not an array", async () => {
    setMatchMedia({ matches: false, modern: true });

    localStorage.setItem("pendingPosterApprovals", JSON.stringify({ nope: true }));
    getReadContractMock.mockResolvedValueOnce({ owner: async () => "0xOWNER" });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));

    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));
    expect(screen.getByRole("dialog", { name: "Approvals" })).toBeTruthy();
    expect(screen.queryAllByRole("listitem").length).toBe(0);
  });

  it("Approvals: ignores pending approvals when localStorage JSON is invalid", async () => {
    setMatchMedia({ matches: false, modern: true });

    localStorage.setItem("pendingPosterApprovals", "{not-json");
    getReadContractMock.mockResolvedValueOnce({ owner: async () => "0xOWNER" });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));

    expect(screen.getByRole("dialog", { name: "Approvals" })).toBeTruthy();
    expect(screen.queryAllByRole("listitem").length).toBe(0);
  });

  it("Approvals: reads pending approvals array from localStorage and trims/filter strings", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    localStorage.setItem(
      "pendingPosterApprovals",
      // mix valid string, whitespace, empty string, and non-string entries
      JSON.stringify([`  ${addr}  `, "", "   ", 5, null])
    );

    getReadContractMock.mockResolvedValue({ owner: async () => "0xOWNER" });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));
    expect(screen.getByRole("dialog", { name: "Approvals" })).toBeTruthy();

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(1);
    expect(screen.getByText("0x0000")).toBeTruthy();
  });

  it("Approvals: remove button updates pending list and localStorage", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    localStorage.setItem("pendingPosterApprovals", JSON.stringify([addr]));
    getReadContractMock.mockResolvedValue({ owner: async () => "0xOWNER" });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));
    expect(screen.getByRole("dialog", { name: "Approvals" })).toBeTruthy();

    const row = await screen.findByRole("listitem");
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));

    await waitForUi(() => screen.queryAllByRole("listitem").length === 0);
    expect(localStorage.getItem("pendingPosterApprovals")).toBe("[]");
  });

  it("Approvals: shows Flagged based on wasPosterDisapproved contract check", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    localStorage.setItem("pendingPosterApprovals", JSON.stringify([addr]));

    getReadContractMock.mockResolvedValue({
      owner: async () => "0xOWNER",
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => true
    } as any);

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));

    await waitForUi(() => !!screen.queryByText("Flagged"));
    expect(screen.getByText("Flagged")).toBeTruthy();
  });

  it("Approvals: on-chain request approve calls setPosterAllowed on write contract", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";

    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: { PosterApprovalRequested: () => ({}) },
      queryFilter: vi.fn(async () => [{ args: [addr] }]),
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false
    };

    const setPosterAllowed = vi.fn(async () => ({}));
    getReadContractMock.mockResolvedValue(readContract);
    getWriteContractMock.mockResolvedValue({ setPosterAllowed });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));

    await waitForUi(() => !!screen.queryByText(/Requests from chain/i));
    const row = screen
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText("0x0000") && within(el).queryByRole("button", { name: "Approve" }));
    if (!row) throw new Error("Expected on-chain request row");

    fireEvent.click(within(row).getByRole("button", { name: "Approve" }));

    await waitForUi(() => setPosterAllowed.mock.calls.length === 1);
    expect(setPosterAllowed).toHaveBeenCalledWith(addr, true);
  });

  it("Approvals: account address links to profile", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    localStorage.setItem("pendingPosterApprovals", JSON.stringify([addr]));

    getReadContractMock.mockResolvedValueOnce({ owner: async () => "0xOWNER" });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));

    await waitForUi(() => {
      const row = screen.getAllByRole("listitem").find((el) => within(el).queryByText("0x0000"));
      if (!row) return false;
      const link = within(row).queryByRole("link");
      return Boolean(link && link.getAttribute("href") === `/profile/${addr}`);
    });
  });

  it("Approvals: on-chain request shows Disapprove after approve, and disapprove calls setPosterAllowed(false)", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";

    let allowed = false;

    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: { PosterApprovalRequested: () => ({}) },
      queryFilter: vi.fn(async () => [{ args: [addr] }]),
      isPosterAllowed: vi.fn(async () => allowed),
      wasPosterDisapproved: async () => false
    };

    const setPosterAllowed = vi.fn(async (_addr: string, next: boolean) => {
      allowed = next;
      return {};
    });
    getReadContractMock.mockResolvedValue(readContract);
    getWriteContractMock.mockResolvedValue({ setPosterAllowed } as any);

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    await waitForUi(() => !!screen.queryByText(/Requests from chain/i));

  // Wait for the initial effect that queries on-chain allowed/disapproved status to settle.
  // Otherwise an in-flight response can overwrite the optimistic UI state after we approve.
  await waitForUi(() => (readContract.isPosterAllowed as any).mock.calls.length >= 1);

    const approveRow = screen
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText("0x0000") && within(el).queryByRole("button", { name: "Approve" }));
    if (!approveRow) throw new Error("Expected on-chain request row");

    fireEvent.click(within(approveRow).getByRole("button", { name: "Approve" }));
    await waitForUi(() => setPosterAllowed.mock.calls.length === 1);
    expect(setPosterAllowed).toHaveBeenCalledWith(addr, true);

    await waitForUi(() => {
      const rows = screen.getAllByRole("listitem");
      return rows.some((el) => within(el).queryByRole("button", { name: "Disapprove" }));
    });

    const disapproveRow = screen
      .getAllByRole("listitem")
      .find((el) => within(el).queryByText("0x0000") && within(el).queryByRole("button", { name: "Disapprove" }));
    if (!disapproveRow) throw new Error("Expected disapprove button row");

    fireEvent.click(within(disapproveRow).getByRole("button", { name: "Disapprove" }));
    await waitForUi(() => setPosterAllowed.mock.calls.length === 2);
    expect(setPosterAllowed).toHaveBeenLastCalledWith(addr, false);
  });

  it("Approvals: when not owner, does not query chain requests", async () => {
    setMatchMedia({ matches: false, modern: true });

    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: { PosterApprovalRequested: () => ({}) },
      queryFilter: vi.fn(async () => [{ args: ["0x000000000000000000000000000000000000BEEF"] }])
    };
    getReadContractMock.mockResolvedValue(readContract);

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xNOTOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    // Approvals button should not be shown when not owner.
    expect(screen.queryByRole("button", { name: "Approvals" })).toBeNull();

    // The chain request query must not run.
    await flushMicrotasks(10);
    expect(readContract.queryFilter).not.toHaveBeenCalled();
  });

  it("Approvals: if owner becomes non-owner while open, clears chain requests", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: { PosterApprovalRequested: () => ({}) },
      queryFilter: vi.fn(async () => [{ args: [addr] }]),
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false
    };
    getReadContractMock.mockResolvedValue(readContract);

    const { rerender, unmount } = render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));

    await waitForUi(() => !!screen.queryByText(/Requests from chain/i));

    // Switch wallet (becomes non-owner) while modal remains open.
    rerender(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xNOTOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !screen.queryByText(/Requests from chain/i));

    // Close modal to ensure Modal effect cleanup runs.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await flushMicrotasks(10);

    unmount();
  });

  it("Approvals: ignores errors while checking allowed/disapproved status", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    localStorage.setItem("pendingPosterApprovals", JSON.stringify([addr]));

    // Owner check uses getReadContract once, chain-requests effect uses it again,
    // and allowed/disapproved status check uses it a third time.
    getReadContractMock.mockResolvedValueOnce({ owner: async () => "0xOWNER" });
    getReadContractMock.mockResolvedValueOnce({
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: { PosterApprovalRequested: () => ({}) },
      queryFilter: vi.fn(async () => [])
    } as any);
    getReadContractMock.mockRejectedValueOnce(new Error("fail"));

    const { unmount } = render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));

    await waitForUi(() => !!screen.queryByRole("dialog", { name: "Approvals" }));
    expect(screen.getByRole("dialog", { name: "Approvals" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await flushMicrotasks(5);
    unmount();
  });

  it("Approvals: reset validates address from localStorage list", async () => {
    setMatchMedia({ matches: false, modern: true });

    localStorage.setItem("pendingPosterApprovals", JSON.stringify(["lol"]));
    getReadContractMock.mockResolvedValueOnce({ owner: async () => "0xOWNER" });

    const { unmount } = render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    await waitForUi(() => !!screen.queryByRole("button", { name: "Approvals" }));
    fireEvent.click(screen.getByRole("button", { name: "Approvals" }));

    await waitForUi(() => !!screen.queryByRole("dialog", { name: "Approvals" }));
    const row = screen.getByRole("listitem");
    fireEvent.click(within(row).getByRole("button", { name: "Reset" }));

    await waitForUi(() => !!screen.queryByText("Invalid address"));
    expect(screen.getByText("Invalid address")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await flushMicrotasks(5);
    unmount();
  });

  it("Approvals: reset skips non-bigint ids and continues after burn tx failure", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 3 } },
      filters: {
        PosterApprovalRequested: () => ({}),
        PostMinted: (a: string) => ({ addr: a })
      },
      queryFilter: vi.fn(async (filter: any) => {
        if (!filter?.addr) return [];
        return [{ args: [addr, "nope"] }, { args: [addr, 2n] }];
      }),
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false
    };

    getReadContractMock.mockResolvedValue(readContract);
    getWriteContractMock.mockResolvedValue({ adminResetAccount } as any);

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    fireEvent.change(screen.getByPlaceholderText("0x... wallet address"), { target: { value: addr } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const row = await screen.findByRole("listitem");
    fireEvent.click(within(row).getByRole("button", { name: "Reset" }));

    await waitForUi(() => adminResetAccount.mock.calls.length >= 1);
    // Only bigint ids are included.
    expect(adminResetAccount).toHaveBeenCalledWith(addr, [2n]);
  });

  it("Approvals: queryFilter failure does not show on-chain requests", async () => {
    setMatchMedia({ matches: false, modern: true });

    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: { PosterApprovalRequested: () => ({}) },
      queryFilter: vi.fn(async () => {
        throw new Error("fail");
      })
    };
    getReadContractMock.mockResolvedValue(readContract);

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    expect(await screen.findByRole("dialog", { name: "Approvals" })).toBeTruthy();
    expect(screen.queryByText(/Requests from chain/i)).toBeNull();
  });

  it("Approvals: on-chain request shows Flagged when wasPosterDisapproved is true", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: { PosterApprovalRequested: () => ({}) },
      queryFilter: vi.fn(async () => [{ args: [addr] }]),
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => true
    };

    getReadContractMock.mockResolvedValue(readContract);

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    expect(await screen.findByText(/Requests from chain/i)).toBeTruthy();
    expect((await screen.findAllByText("Flagged")).length).toBeGreaterThan(0);
  });

  it("Approvals: reset returns early when block poster tx fails", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 0 } },
      filters: {
        PosterApprovalRequested: () => ({}),
        PostMinted: (a: string) => ({ addr: a })
      },
      queryFilter: vi.fn(async () => []),
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false
    };

    const adminClearProfile = vi.fn(async () => ({}));
    getReadContractMock.mockResolvedValue(readContract);
    getWriteContractMock.mockResolvedValue({
      adminResetAccount: vi.fn(async () => {
        throw new Error("fail");
      }),
      adminClearProfile
    });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    fireEvent.change(screen.getByPlaceholderText("0x... wallet address"), {
      target: { value: addr }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const row = await screen.findByRole("listitem");
    fireEvent.click(within(row).getByRole("button", { name: "Reset" }));

    await flushMicrotasks(10);
    expect(adminClearProfile).not.toHaveBeenCalled();
  });

  it("renders profile and loads follower profiles when opened (modern matchMedia)", async () => {
    setMatchMedia({ matches: false, modern: true });

    loadProfileMock.mockClear();

    const onDisconnectWallet = vi.fn();
    const onStartEditProfile = vi.fn();

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={2}
          followerCount={2}
          followers={["0xAAA", "0xBBB"]}
          following={["0xCCC"]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={onDisconnectWallet}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={onStartEditProfile}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View followers" }));
    expect(await screen.findByText("Followers")).toBeTruthy();

    // Should render follower rows.
    expect(screen.getAllByText("Open profile").length).toBeGreaterThan(0);

    // loadProfile should be called for the first 24 followers.
    await waitForUi(() => {
      const calls = (loadProfileMock.mock.calls as unknown as Array<[string]>);
      return calls.some(([a]) => a === "0xAAA") && calls.some(([a]) => a === "0xBBB");
    });
    expect(loadProfileMock).toHaveBeenCalledWith("0xAAA");
    expect(loadProfileMock).toHaveBeenCalledWith("0xBBB");

  });

  it("Approvals: approve/disapprove toggles buttons and shows Flagged", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";

    let allowed = false;
    let disapprovedEver = false;

    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 0 } },
      filters: {
        PosterApprovalRequested: () => ({}),
        PostMinted: (a: string) => ({ addr: a })
      },
      queryFilter: vi.fn(async () => []),
      isPosterAllowed: async () => allowed,
      wasPosterDisapproved: async () => disapprovedEver
    };

    const writeContract: any = {
      setPosterAllowed: vi.fn(async (_addr: string, nextAllowed: boolean) => {
        allowed = nextAllowed;
        if (!nextAllowed) disapprovedEver = true;
        return {};
      })
    };

    getReadContractMock.mockResolvedValue(readContract);
    getWriteContractMock.mockResolvedValue(writeContract);

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    expect(await screen.findByRole("dialog", { name: "Approvals" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("0x... wallet address"), {
      target: { value: addr }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // Initially should show Approve.
    expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitForUi(() => screen.queryByRole("button", { name: "Approve" }) === null);

    // Now Disapprove should be visible.
    expect(await screen.findByRole("button", { name: "Disapprove" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Disapprove" }));
    await waitForUi(() => !!screen.queryByText("Flagged"));
    expect(screen.getByText("Flagged")).toBeTruthy();
  });

  it("Approvals: shows on-chain requests list and can reset (failure path shows error)", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 100 } },
      filters: {
        PosterApprovalRequested: () => ({}),
        PostMinted: (a: string) => ({ addr: a })
      },
      queryFilter: vi.fn(async (filter: any) => {
        if (filter?.addr) throw new Error("no logs");
        return [{ args: [addr] }];
      }),
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false
    };

    getReadContractMock.mockResolvedValue(readContract);
    getWriteContractMock.mockResolvedValueOnce({
      adminResetAccount: vi.fn(async () => ({}))
    });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));
    expect(await screen.findByText(/Requests from chain/i)).toBeTruthy();

    // Trigger reset on-chain request; PostMinted queryFilter throws => error shown.
    const resets = screen.getAllByRole("button", { name: "Reset" });
    fireEvent.click(resets[0]);

    expect(await screen.findByText("Blocked user, but failed to load their posts for deletion.")).toBeTruthy();
  });

  it("Approvals: reset burns unique minted posts (success path)", async () => {
    setMatchMedia({ matches: false, modern: true });

    const addr = "0x000000000000000000000000000000000000BEEF";
    const adminResetAccount = vi.fn(async () => ({}));

    const readContract: any = {
      owner: async () => "0xOWNER",
      runner: { provider: { getBlockNumber: async () => 3 } },
      filters: {
        PosterApprovalRequested: () => ({}),
        PostMinted: (a: string) => ({ addr: a })
      },
      queryFilter: vi.fn(async (filter: any) => {
        if (!filter?.addr) return [];
        return [{ args: [addr, 1n] }, { args: [addr, 2n] }, { args: [addr, 2n] }];
      }),
      isPosterAllowed: async () => false,
      wasPosterDisapproved: async () => false
    };

    getReadContractMock.mockResolvedValue(readContract);
    getWriteContractMock.mockResolvedValue({
      adminResetAccount
    });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xOWNER"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approvals" }));

    // Add as pending, then reset.
    fireEvent.change(screen.getByPlaceholderText("0x... wallet address"), {
      target: { value: addr }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const row = await screen.findByRole("listitem");
    const reset = within(row).getByRole("button", { name: "Reset" });
    fireEvent.click(reset);

    await waitForUi(() => adminResetAccount.mock.calls.length === 1);
    // Deduped tokenIds.
    expect(adminResetAccount).toHaveBeenCalledWith(addr, [1n, 2n]);
  });

  it("loads following profiles when opened", async () => {
    setMatchMedia({ matches: false, modern: true });

    loadProfileMock.mockClear();

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={2}
          followerCount={0}
          followers={[]}
          following={["0xCCC"]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "View following" }));
    expect(await screen.findByText("Following")).toBeTruthy();

    await waitForUi(() => {
      const calls = (loadProfileMock.mock.calls as unknown as Array<[string]>);
      return calls.some(([a]) => a === "0xCCC");
    });
    expect(loadProfileMock).toHaveBeenCalledWith("0xCCC");

    // Following list avatar should use backgroundImage if profile exists.
    const avatars = document.querySelectorAll(".avatar.tiny");
    const anyHasBg = Array.from(avatars).some((el) =>
      (el as HTMLDivElement).style.backgroundImage.includes("/ipfs/avatar2")
    );
    expect(anyHasBg).toBe(true);
  });

  it("evaluates header pill operands and omits followers pill when followerCount is undefined", () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={undefined}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    // Should not render followers pill when followerCount isn't a number.
    expect(screen.queryByRole("button", { name: "View followers" })).toBeNull();
  });

  it("renders header pills when only following length is available", () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={undefined}
          followerCount={undefined}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    // Pills should render due to `following?.length` being a number.
    expect(screen.getByRole("button", { name: "View following" })).toBeTruthy();
  });

  it("uses fallback avatar background in following modal when profile has no avatar", async () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={1}
          followerCount={0}
          followers={[]}
          following={["0xDDD"]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "View following" }));
    expect(await screen.findByText("Following")).toBeTruthy();

    const avatar = document.querySelector(".list .avatar.tiny") as HTMLDivElement | null;
    expect(avatar).toBeTruthy();
    expect(avatar?.style.backgroundImage).toBe("");
  });

  it("renders avatar preview when editing and draft data URL is an image", async () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={true}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl="data:image/png;base64,aaa"
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    expect(await screen.findByAltText("Avatar preview")).toBeInTheDocument();
  });

  it("fires edit profile modal handlers", async () => {
    setMatchMedia({ matches: false, modern: true });

    const onProfileDraftNameChange = vi.fn();
    const onProfileDraftBioChange = vi.fn();
    const onProfileDraftAvatarUrlChange = vi.fn();
    const onSelectProfileAvatarFile = vi.fn(async () => undefined);
    const onClearProfileAvatar = vi.fn();
    const onCancelEditProfile = vi.fn();
    const onSaveProfile = vi.fn();

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={true}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={onProfileDraftNameChange}
          onProfileDraftBioChange={onProfileDraftBioChange}
          onProfileDraftAvatarUrlChange={onProfileDraftAvatarUrlChange}
          onSelectProfileAvatarFile={onSelectProfileAvatarFile}
          onClearProfileAvatar={onClearProfileAvatar}
          onStartEditProfile={vi.fn()}
          onCancelEditProfile={onCancelEditProfile}
          onSaveProfile={onSaveProfile}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    const dialog = screen.getByRole("dialog", { name: "Edit profile" });

    fireEvent.change(within(dialog).getByPlaceholderText("Display name"), { target: { value: "Z" } });
    expect(onProfileDraftNameChange).toHaveBeenCalledWith("Z");

    fireEvent.change(within(dialog).getByPlaceholderText("Bio"), { target: { value: "Hello" } });
    expect(onProfileDraftBioChange).toHaveBeenCalledWith("Hello");

    fireEvent.change(within(dialog).getByPlaceholderText(/Avatar image URL/i), { target: { value: "ipfs://a" } });
    expect(onProfileDraftAvatarUrlChange).toHaveBeenCalledWith("ipfs://a");

    const fileInput = dialog.querySelector("input.file-input") as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitForUi(() => onSelectProfileAvatarFile.mock.calls.length >= 1);
    expect(onSelectProfileAvatarFile).toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(onClearProfileAvatar).toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onCancelEditProfile).toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(onSaveProfile).toHaveBeenCalled();
  });

  it("closes follower/following modals and toggles details", async () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={1}
          followers={["0xAAA"]}
          following={["0xCCC"]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    const details = document.querySelector("details.profileDropdown") as HTMLDetailsElement | null;
    expect(details).toBeTruthy();
    if (!details) throw new Error("Expected profile details element");
    details.open = false;
    fireEvent(details, new Event("toggle"));

    await waitForUi(() => {
      const next = document.querySelector("details.profileDropdown") as HTMLDetailsElement | null;
      return next?.open === false;
    });

    fireEvent.click(screen.getByRole("button", { name: "View followers" }));
    expect(await screen.findByRole("dialog", { name: "Followers" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitForUi(() => screen.queryByRole("dialog", { name: "Followers" }) === null);

    fireEvent.click(screen.getByRole("button", { name: "View following" }));
    expect(await screen.findByRole("dialog", { name: "Following" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitForUi(() => screen.queryByRole("dialog", { name: "Following" }) === null);
  });

  it("shows empty follower/following states and loading ellipsis", async () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio=""
          profileAvatarUrl="ipfs://avatar"
          myPostsCount={undefined}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={true}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    // Avatar uses backgroundImage when url is present.
    const avatar = document.querySelector(".avatar") as HTMLDivElement | null;
    expect(avatar?.style.backgroundImage).toContain("/ipfs/avatar");

    // Following pill shows ellipsis when loading.
    const followingBtn = screen.getByRole("button", { name: "View following" });
    expect(followingBtn.textContent).toContain("…");

    fireEvent.click(screen.getByRole("button", { name: "View followers" }));
    expect(await screen.findByText("No followers yet.")).toBeTruthy();

    // Following is disabled while loading, so modal should not open.
    expect((followingBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows empty following modal when not loading", async () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio=""
          profileAvatarUrl=""
          myPostsCount={undefined}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "View following" }));
    expect(await screen.findByText("Not following anyone yet.")).toBeTruthy();
  });

  it("does not try to load follower profiles when followers is null", async () => {
    setMatchMedia({ matches: false, modern: true });
    loadProfileMock.mockClear();

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={null}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "View followers" }));
    expect(await screen.findByText("No followers yet.")).toBeTruthy();
    expect(loadProfileMock).not.toHaveBeenCalled();
  });

  it("renders 0 following when following is null", () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <ProfileCard
          walletAddress="0xAAA"
          displayName="Me"
          profileBio="Bio"
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={null}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={vi.fn()}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={123}
          shortAddress={(a) => a.slice(0, 6)}
        />
      </MemoryRouter>
    );

    const followingBtn = screen.getByRole("button", { name: "View following" });
    expect(followingBtn.textContent).toContain("0 following");
  });

  it("renders wallet info and disables actions when disconnected (legacy matchMedia)", () => {
    setMatchMedia({ matches: true, modern: false });

    render(
      <WalletCard
        walletAddress={null}
        chainId={null}
        networkName={null}
        nativeBalance="0"
        withdrawableTipsWei={0n}
        contractAddress={undefined}
        contractDeployed={null}
        status=""
        onRefreshWalletPanel={vi.fn()}
        onWithdrawTips={vi.fn()}
        shortAddress={(a) => a.slice(0, 6)}
        getNativeSymbol={() => "ETH"}
      />
    );

    expect(screen.getAllByText("Wallet").length).toBeGreaterThan(0);
    expect(screen.getByText("Disconnected")).toBeTruthy();

    const refresh = screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement;
    const withdraw = screen.getByRole("button", { name: "Withdraw tips" }) as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
    expect(withdraw.disabled).toBe(true);
  });

  it("formats tips when withdrawableTipsWei is greater than zero", () => {
    setMatchMedia({ matches: true, modern: false });

    render(
      <WalletCard
        walletAddress="0xAAA"
        chainId="31337"
        networkName="Local"
        nativeBalance="0"
        withdrawableTipsWei={10n ** 18n}
        contractAddress={undefined}
        contractDeployed={null}
        status=""
        onRefreshWalletPanel={vi.fn()}
        onWithdrawTips={vi.fn()}
        shortAddress={(a) => a.slice(0, 6)}
        getNativeSymbol={() => "ETH"}
      />
    );

    expect(screen.getByText("1.0000 ETH")).toBeInTheDocument();
  });

  it("shows chainId when networkName is missing", () => {
    setMatchMedia({ matches: true, modern: false });

    render(
      <WalletCard
        walletAddress="0xAAA"
        chainId="31337"
        networkName={null}
        nativeBalance="0"
        withdrawableTipsWei={0n}
        contractAddress={undefined}
        contractDeployed={null}
        status=""
        onRefreshWalletPanel={vi.fn()}
        onWithdrawTips={vi.fn()}
        shortAddress={(a) => a.slice(0, 6)}
        getNativeSymbol={() => "ETH"}
      />
    );

    expect(screen.getByText("31337")).toBeInTheDocument();
  });

  it("shows dash when networkName and chainId are missing", () => {
    setMatchMedia({ matches: true, modern: false });

    render(
      <WalletCard
        walletAddress="0xAAA"
        chainId={null}
        networkName={null}
        nativeBalance="0"
        withdrawableTipsWei={0n}
        contractAddress={undefined}
        contractDeployed={null}
        status=""
        onRefreshWalletPanel={vi.fn()}
        onWithdrawTips={vi.fn()}
        shortAddress={(a) => a.slice(0, 6)}
        getNativeSymbol={() => "ETH"}
      />
    );

    const networkField = screen.getByText("Network").parentElement as HTMLElement | null;
    expect(networkField).toBeTruthy();
    const valueEl = networkField?.querySelector(".value") as HTMLElement | null;
    expect(valueEl?.textContent).toBe("—");
  });

  it("shows contract address suffix when not deployed on this chain", () => {
    setMatchMedia({ matches: true, modern: false });

    render(
      <WalletCard
        walletAddress="0xAAA"
        chainId="31337"
        networkName="Local"
        nativeBalance="0"
        withdrawableTipsWei={0n}
        contractAddress="0x000000000000000000000000000000000000BEEF"
        contractDeployed={false}
        status=""
        onRefreshWalletPanel={vi.fn()}
        onWithdrawTips={vi.fn()}
        shortAddress={(a) => a.slice(0, 6)}
        getNativeSymbol={() => "ETH"}
      />
    );

    expect(screen.getByText(/\(not on this chain\)/i)).toBeInTheDocument();
  });

  it("toggles wallet details open state", async () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <WalletCard
        walletAddress="0xAAA"
        chainId="31337"
        networkName="Local"
        nativeBalance="0"
        withdrawableTipsWei={0n}
        contractAddress={undefined}
        contractDeployed={null}
        status=""
        onRefreshWalletPanel={vi.fn()}
        onWithdrawTips={vi.fn()}
        shortAddress={(a) => a.slice(0, 6)}
        getNativeSymbol={() => "ETH"}
      />
    );

    const details = document.querySelector("details.walletDropdown") as HTMLDetailsElement | null;
    expect(details).toBeTruthy();
    if (!details) throw new Error("Expected wallet details element");

    details.open = false;
    fireEvent(details, new Event("toggle"));

    await waitForUi(() => {
      const next = document.querySelector("details.walletDropdown") as HTMLDetailsElement | null;
      return next?.open === false;
    });
  });

  it("Sidebar composes ProfileCard + WalletCard", () => {
    setMatchMedia({ matches: false, modern: true });

    render(
      <MemoryRouter>
        <Sidebar
          walletAddress={null}
          displayName="Anon"
          profileBio=""
          profileAvatarUrl=""
          myPostsCount={0}
          followerCount={0}
          followers={[]}
          following={[]}
          isLoadingFollowers={false}
          isLoadingFollowing={false}
          onDisconnectWallet={() => undefined}
          isEditingProfile={false}
          profileDraftName=""
          profileDraftBio=""
          profileDraftAvatarUrl=""
          profileDraftAvatarDataUrl=""
          isProfileAvatarLoading={false}
          onProfileDraftNameChange={() => undefined}
          onProfileDraftBioChange={() => undefined}
          onProfileDraftAvatarUrlChange={() => undefined}
          onSelectProfileAvatarFile={async () => undefined}
          onClearProfileAvatar={() => undefined}
          onStartEditProfile={() => undefined}
          onCancelEditProfile={() => undefined}
          onSaveProfile={() => undefined}
          selfAvatarHue={0}
          chainId={null}
          networkName={null}
          nativeBalance="0"
          withdrawableTipsWei={0n}
          contractAddress={undefined}
          contractDeployed={null}
          status=""
          onRefreshWalletPanel={() => undefined}
          onWithdrawTips={() => undefined}
          shortAddress={(a) => a.slice(0, 6)}
          getNativeSymbol={() => "ETH"}
        />
      </MemoryRouter>
    );

    expect(document.querySelector("aside.sidebar")).toBeTruthy();
    expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wallet").length).toBeGreaterThan(0);
  });
});
