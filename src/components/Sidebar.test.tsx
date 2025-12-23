import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfileCard, Sidebar, WalletCard } from "./Sidebar";

const loadProfileMock = vi.fn(async () => undefined);

vi.mock("../contexts/AppContext", () => {
  return {
    useApp: () => ({
      loadProfile: loadProfileMock,
      profilesByAddress: {
        "0xaaa": { name: "A", bio: "", avatarUrl: "ipfs://avatar" },
        "0xccc": { name: "C", bio: "", avatarUrl: "ipfs://avatar2" }
      },
      stableHueFromSeed: (seed: string) => (seed.length * 13) % 360
    })
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

describe("Sidebar/ProfileCard/WalletCard", () => {
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
    await waitFor(() => {
      expect(loadProfileMock).toHaveBeenCalledWith("0xAAA");
      expect(loadProfileMock).toHaveBeenCalledWith("0xBBB");
    });

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

    await waitFor(() => {
      expect(loadProfileMock).toHaveBeenCalledWith("0xCCC");
    });

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

    await waitFor(() => {
      expect(onSelectProfileAvatarFile).toHaveBeenCalled();
    });

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

    await waitFor(() => {
      const next = document.querySelector("details.profileDropdown") as HTMLDetailsElement | null;
      expect(next?.open).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "View followers" }));
    expect(await screen.findByRole("dialog", { name: "Followers" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Followers" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "View following" }));
    expect(await screen.findByRole("dialog", { name: "Following" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Following" })).toBeNull();
    });
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

    await waitFor(() => {
      const next = document.querySelector("details.walletDropdown") as HTMLDetailsElement | null;
      expect(next?.open).toBe(false);
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
