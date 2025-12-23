import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    walletAddress: "0x000000000000000000000000000000000000bEEF" as string | null,
    provider: {} as any,
    hasPinata: false,
    setStatus: vi.fn(),
    runContractTx: vi.fn().mockImplementation(async (_label: string, send: () => Promise<any>) => {
      await send();
      return undefined;
    }),
    readContract: {
      profileOf: vi.fn().mockResolvedValue(["Alice", "Bio", "ipfs://avatar"]) as any
    } as any,
    writeContract: {
      setProfile: vi.fn().mockResolvedValue({})
    } as any,
    pinataPinFile: vi.fn().mockResolvedValue({ IpfsHash: "QmAvatar" }),
    posts: [] as any[]
  };
});

vi.mock("../ipfs", () => ({
  hasPinata: () => mocks.hasPinata,
  pinataPinFile: (...args: any[]) => mocks.pinataPinFile(...args)
}));

vi.mock("./WalletContext", () => ({
  useWallet: () => ({ provider: mocks.provider, walletAddress: mocks.walletAddress })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./FeedContext", () => ({
  useFeed: () => ({ posts: mocks.posts })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    getReadContract: async () => mocks.readContract,
    getWriteContract: async () => mocks.writeContract,
    ensureContractDeployedOnCurrentNetwork: async () => {}
  })
}));

vi.mock("./useContractTx", () => ({
  useContractTx: () => ({ runContractTx: mocks.runContractTx })
}));

import { ProfileProvider, useProfile } from "./ProfileContext";

function renderWithGrabber() {
  let ctx: any;
  function Grabber() {
    ctx = useProfile();
    return null;
  }

  const tree = (
    <ProfileProvider>
      <Grabber />
    </ProfileProvider>
  );

  const rendered = render(tree);

  return {
    get: () => ctx as ReturnType<typeof useProfile>,
    rerender: () => rendered.rerender(tree)
  };
}

beforeEach(() => {
  mocks.walletAddress = "0x000000000000000000000000000000000000bEEF";
  mocks.provider = {};
  mocks.hasPinata = false;
  mocks.setStatus.mockClear();
  mocks.runContractTx.mockClear();
  mocks.writeContract.setProfile.mockClear();
  mocks.readContract.profileOf.mockClear();
  mocks.readContract.profileOf.mockResolvedValue(["Alice", "Bio", "ipfs://avatar"]);
  mocks.pinataPinFile.mockClear();
  mocks.pinataPinFile.mockResolvedValue({ IpfsHash: "QmAvatar" });
  mocks.posts = [];
});

describe("ProfileContext transactions", () => {
  it("loadProfile returns early when provider is missing", async () => {
    mocks.walletAddress = null;
    mocks.provider = null as any;
    const { get } = renderWithGrabber();
    mocks.readContract.profileOf.mockClear();

    await act(async () => {
      await get().loadProfile("0xAAA");
    });

    expect(mocks.readContract.profileOf).not.toHaveBeenCalled();
  });

  it("loadProfile supports object tuples and defaults missing fields", async () => {
    mocks.walletAddress = null;
    mocks.readContract.profileOf.mockResolvedValueOnce({ name: undefined, bio: undefined, avatar: undefined } as any);
    const { get } = renderWithGrabber();

    await act(async () => {
      await get().loadProfile("0xAAA");
    });

    expect(get().profilesByAddress["0xaaa"]).toEqual({ name: "", bio: "", avatarUrl: "" });
  });

  it("loadProfile (self) sets empty-string fallbacks when tuple entries are empty", async () => {
    mocks.walletAddress = "0xAbC";
    mocks.readContract.profileOf.mockResolvedValueOnce(["", "", ""] as any);

    const { get } = renderWithGrabber();

    await waitFor(() => {
      expect(get().profilesByAddress["0xabc"]).toEqual({ name: "", bio: "", avatarUrl: "" });
    });

    expect(get().profileName).toBe("");
    expect(get().profileBio).toBe("");
    expect(get().profileAvatarUrl).toBe("");
  });

  it("saveProfile returns early when wallet is disconnected", async () => {
    mocks.walletAddress = null;
    const { get } = renderWithGrabber();

    await act(async () => {
      await get().saveProfile();
    });

    expect(mocks.writeContract.setProfile).not.toHaveBeenCalled();
    expect(mocks.runContractTx).not.toHaveBeenCalled();
  });
  it("saveProfile calls setProfile and updates local state", async () => {
    const { get } = renderWithGrabber();

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftName(" Alice ");
      get().setProfileDraftBio(" Bio ");
      get().setProfileDraftAvatarUrl(" ipfs://avatar ");
    });

    await act(async () => {
      await get().saveProfile();
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Save profile", expect.any(Function));
    expect(mocks.writeContract.setProfile).toHaveBeenCalledWith("Alice", "Bio", "ipfs://avatar");

    expect(get().profileName).toBe("Alice");
    expect(get().profileBio).toBe("Bio");
    expect(get().profileAvatarUrl).toBe("ipfs://avatar");
    expect(get().isEditingProfile).toBe(false);
  });

  it("loadProfile populates cache and self profile fields when not editing", async () => {
    mocks.walletAddress = "0xAbC";
    mocks.readContract.profileOf.mockResolvedValue(["Zed", "Hello", "ipfs://a"]);
    const { get } = renderWithGrabber();

    await act(async () => {
      await get().loadProfile("0xAbC");
    });

    expect(get().profilesByAddress["0xabc"]).toEqual({ name: "Zed", bio: "Hello", avatarUrl: "ipfs://a" });
    expect(get().profileName).toBe("Zed");
    expect(get().profileBio).toBe("Hello");
    expect(get().profileAvatarUrl).toBe("ipfs://a");
  });

  it("loadProfile dedupes in-flight requests", async () => {
    mocks.walletAddress = null;
    let resolve: ((v: any) => void) | null = null;
    const p = new Promise<any>((r) => (resolve = r));
    mocks.readContract.profileOf.mockReturnValueOnce(p);
    const { get } = renderWithGrabber();

    const a = get().loadProfile("0xAAA");
    const b = get().loadProfile("0xAAA");

    resolve?.(["A", "B", "C"]);
    await act(async () => {
      await Promise.all([a, b]);
    });

    expect(mocks.readContract.profileOf).toHaveBeenCalledTimes(1);
    expect(get().profilesByAddress["0xaaa"]).toEqual({ name: "A", bio: "B", avatarUrl: "C" });
  });

  it("loadProfile does not overwrite cache if updated while in-flight", async () => {
    mocks.walletAddress = "0xAbC";
    let resolve: ((v: any) => void) | null = null;
    const p = new Promise<any>((r) => (resolve = r));
    mocks.readContract.profileOf.mockReturnValueOnce(p);

    const { get } = renderWithGrabber();

    const load = get().loadProfile("0xAbC");

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftName("Saved");
    });

    await act(async () => {
      await get().saveProfile();
    });

    expect(mocks.writeContract.setProfile).toHaveBeenCalledWith("Saved", "", "");

    resolve?.(["Loaded", "Bio", "ipfs://loaded"]);
    await act(async () => {
      await load;
    });

    expect(get().profilesByAddress["0xabc"]).toEqual({ name: "Saved", bio: "", avatarUrl: "" });
  });

    it("loadProfile ignores chain errors", async () => {
      mocks.walletAddress = null;
      mocks.readContract.profileOf.mockRejectedValueOnce(new Error("rpc down"));
      const { get } = renderWithGrabber();

      await act(async () => {
        await get().loadProfile("0xAAA");
      });

      expect(get().profilesByAddress["0xaaa"]).toBeUndefined();
      expect(mocks.setStatus).not.toHaveBeenCalled();
    });

  it("resets profile state when wallet disconnects", async () => {
    let resolve: ((v: any) => void) | null = null;
    const p = new Promise<any>((r) => (resolve = r));
    mocks.readContract.profileOf.mockReturnValueOnce(p);

    const { get, rerender } = renderWithGrabber();

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftName("Alice");
    });
    expect(get().isEditingProfile).toBe(true);

    mocks.walletAddress = null;
    rerender();

    resolve?.(["Alice", "Bio", "ipfs://avatar"]);
    await act(async () => {
      await p;
    });

    expect(get().profileName).toBe("");
    expect(get().profileBio).toBe("");
    expect(get().profileAvatarUrl).toBe("");
    expect(get().isEditingProfile).toBe(false);
  });

  it("onSelectProfileAvatarFile stores data URL and clears avatar URL", async () => {
    const { get } = renderWithGrabber();

    const originalFileReader = (globalThis as any).FileReader;
    class FR {
      result: any = "data:image/png;base64,AAA";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL(_file: any) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    (globalThis as any).FileReader = FR as any;

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftAvatarUrl("https://example.com/avatar.png");
    });

    vi.useFakeTimers();
    await act(async () => {
      const task = get().onSelectProfileAvatarFile(new File(["x"], "a.png", { type: "image/png" }));
      await vi.runAllTimersAsync();
      await task;
    });
    vi.useRealTimers();

    expect(get().profileDraftAvatarUrl).toBe("");
    expect(get().profileDraftAvatarDataUrl.startsWith("data:image/")).toBe(true);

    (globalThis as any).FileReader = originalFileReader;
  });

  it("onSelectProfileAvatarFile uses filename/result fallbacks", async () => {
    const { get } = renderWithGrabber();

    const originalFileReader = (globalThis as any).FileReader;
    class FR {
      result: any = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL(_file: any) {
        this.onload?.();
      }
    }
    (globalThis as any).FileReader = FR as any;

    await act(async () => {
      get().startEditProfile();
      await get().onSelectProfileAvatarFile(new File(["x"], "", { type: "image/png" }));
    });

    expect(get().profileDraftAvatarUrl).toBe("");
    expect(get().profileDraftAvatarDataUrl).toBe("");

    ;(globalThis as any).FileReader = originalFileReader;
  });

  it("onSelectProfileAvatarFile rejects when FileReader fails and clears loading", async () => {
    const { get } = renderWithGrabber();

    const originalFileReader = (globalThis as any).FileReader;
    class FR {
      result: any = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL(_file: any) {
        this.onerror?.();
      }
    }
    (globalThis as any).FileReader = FR as any;

    let thrown: unknown;
    await act(async () => {
      get().startEditProfile();
      try {
        await get().onSelectProfileAvatarFile(new File(["x"], "a.png", { type: "image/png" }));
      } catch (err) {
        thrown = err;
      }
    });

    expect(String((thrown as any)?.message ?? thrown)).toMatch(/Failed to read file/);
    expect(get().isProfileAvatarLoading).toBe(false);

    (globalThis as any).FileReader = originalFileReader;
  });

  it("onClearProfileAvatar clears uploaded state", async () => {
    const { get } = renderWithGrabber();

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftAvatarUrl("ipfs://x");
    });

    await act(async () => {
      get().onClearProfileAvatar();
    });

    expect(get().profileDraftAvatarUrl).toBe("");
    expect(get().profileDraftAvatarDataUrl).toBe("");
  });

  it("onSelectProfileAvatarFile(null) clears uploaded state", async () => {
    const { get } = renderWithGrabber();

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftAvatarUrl("ipfs://x");
    });

    await act(async () => {
      await get().onSelectProfileAvatarFile(null);
    });

    expect(get().profileDraftAvatarUrl).toBe("ipfs://x");
    expect(get().profileDraftAvatarDataUrl).toBe("");
  });

    it("cancelEditProfile resets draft fields", async () => {
      const { get } = renderWithGrabber();

      const originalFileReader = (globalThis as any).FileReader;
      class FR {
        result: any = "data:image/png;base64,AAA";
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        readAsDataURL(_file: any) {
          this.onload?.();
        }
      }
      (globalThis as any).FileReader = FR as any;

      await act(async () => {
        // Prime the saved profile state.
        get().startEditProfile();
        get().setProfileDraftName("Alice");
        get().setProfileDraftBio("Bio");
        get().setProfileDraftAvatarUrl("ipfs://avatar");
      });

      await act(async () => {
        await get().saveProfile();
      });

      await act(async () => {
        get().startEditProfile();
        get().setProfileDraftName("Temp");
        get().setProfileDraftBio("Temp");
        get().setProfileDraftAvatarUrl("https://example.com/x.png");
        await get().onSelectProfileAvatarFile(new File(["x"], "avatar.png", { type: "image/png" }));
      });

      expect(get().profileDraftAvatarDataUrl).toBe("data:image/png;base64,AAA");
      expect(get().isEditingProfile).toBe(true);

      await act(async () => {
        get().cancelEditProfile();
      });

      expect(get().isEditingProfile).toBe(false);
      expect(get().profileDraftName).toBe(get().profileName);
      expect(get().profileDraftBio).toBe(get().profileBio);
      expect(get().profileDraftAvatarUrl).toBe(get().profileAvatarUrl);
      expect(get().profileDraftAvatarDataUrl).toBe("");

      (globalThis as any).FileReader = originalFileReader;
    });

    it("saveProfile reports errors", async () => {
      const { get } = renderWithGrabber();
      mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        get().startEditProfile();
        get().setProfileDraftName("Alice");
        get().setProfileDraftBio("Bio");
        get().setProfileDraftAvatarUrl("ipfs://avatar");
      });

      await act(async () => {
        await get().saveProfile();
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
      expect(get().isEditingProfile).toBe(true);
    });

  it("saveProfile with uploaded avatar uses pinata when configured", async () => {
    mocks.hasPinata = true;
    const { get } = renderWithGrabber();

    const originalFileReader = (globalThis as any).FileReader;
    class FR {
      result: any = "data:image/png;base64,AAA";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL(_file: any) {
        this.onload?.();
      }
    }
    (globalThis as any).FileReader = FR as any;

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftName("Alice");
      await get().onSelectProfileAvatarFile(new File(["x"], "avatar.png", { type: "image/png" }));
    });

    await act(async () => {
      await get().saveProfile();
    });

    expect(mocks.pinataPinFile).toHaveBeenCalled();
    expect(mocks.writeContract.setProfile).toHaveBeenCalledWith("Alice", "", "ipfs://QmAvatar");

    (globalThis as any).FileReader = originalFileReader;
  });

  it("saveProfile with uploaded avatar falls back to data URL when pinata is not configured", async () => {
    mocks.hasPinata = false;
    const { get } = renderWithGrabber();

    const originalFileReader = (globalThis as any).FileReader;
    class FR {
      result: any = "data:image/png;base64,AAA";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL(_file: any) {
        this.onload?.();
      }
    }
    (globalThis as any).FileReader = FR as any;

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftName("Alice");
      await get().onSelectProfileAvatarFile(new File(["x"], "avatar.png", { type: "image/png" }));
    });

    await act(async () => {
      await get().saveProfile();
    });

    expect(mocks.pinataPinFile).not.toHaveBeenCalled();
    expect(mocks.writeContract.setProfile).toHaveBeenCalledWith("Alice", "", "data:image/png;base64,AAA");

    (globalThis as any).FileReader = originalFileReader;
  });

  it("saveProfile with uploaded avatar uses empty-string fallback when data URL is empty", async () => {
    mocks.hasPinata = false;
    const { get } = renderWithGrabber();

    const originalFileReader = (globalThis as any).FileReader;
    class FR {
      result: any = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL(_file: any) {
        this.onload?.();
      }
    }
    (globalThis as any).FileReader = FR as any;

    await act(async () => {
      get().startEditProfile();
      get().setProfileDraftName("Alice");
      await get().onSelectProfileAvatarFile(new File(["x"], "avatar.png", { type: "image/png" }));
    });

    await act(async () => {
      await get().saveProfile();
    });

    expect(mocks.pinataPinFile).not.toHaveBeenCalled();
    expect(mocks.writeContract.setProfile).toHaveBeenCalledWith("Alice", "", "");

    (globalThis as any).FileReader = originalFileReader;
  });

  it("authorIdentity derives names/hues and avatarUrl for post authors", async () => {
    mocks.walletAddress = null;
    mocks.posts = [
      { tokenId: "1", author: "0xAa", title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n },
      { tokenId: "2", author: "0xBb", title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }
    ] as any;
    mocks.readContract.profileOf.mockResolvedValue(["Name", "Bio", "ipfs://a"]);

    const { get } = renderWithGrabber();

    await act(async () => {
      await get().loadProfile("0xAa");
    });

    const aa = get().authorIdentity.get("0xaa");
    expect(aa?.name).toBe("Name");
    expect(typeof aa?.hue).toBe("number");
    expect(aa?.avatarUrl).toBe("ipfs://a");
  });

  it("opportunistically loads missing author profiles when posts appear", async () => {
    mocks.walletAddress = null;
    mocks.provider = {};
    mocks.posts = [
      { tokenId: "1", author: "0xAa", title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n },
      { tokenId: "2", author: "0xBb", title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }
    ] as any;

    renderWithGrabber();

    await waitFor(() => {
      expect(mocks.readContract.profileOf).toHaveBeenCalled();
    });

    const calledWith = mocks.readContract.profileOf.mock.calls.map((c: any[]) => String(c[0]).toLowerCase());
    expect(calledWith).toEqual(expect.arrayContaining(["0xaa", "0xbb"]));
  });

  it("authorIdentity skips missing authors and de-dupes duplicates", async () => {
    mocks.walletAddress = null;
    mocks.posts = [
      { tokenId: "1", author: undefined, title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n },
      { tokenId: "2", author: "0xAa", title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n },
      { tokenId: "3", author: "0xAa", title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }
    ] as any;

    const { get } = renderWithGrabber();
    await act(async () => {
      await get().loadProfile("0xAa");
    });

    expect(get().authorIdentity.size).toBe(1);
    expect(get().authorIdentity.has("0xaa")).toBe(true);
  });

  it("opportunistic loader returns early when provider is missing", async () => {
    mocks.walletAddress = null;
    mocks.provider = null as any;
    mocks.posts = [{ tokenId: "1", author: "0xAa", title: "", body: "", image: "", metadataURI: "", likes: 0, comments: 0, shares: 0, tipsWei: 0n }] as any;
    mocks.readContract.profileOf.mockClear();

    renderWithGrabber();

    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.readContract.profileOf).not.toHaveBeenCalled();
  });
});

describe("useProfile", () => {
  it("throws when used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      function Bad() {
        useProfile();
        return null;
      }

      expect(() => render(<Bad />)).toThrowError("useProfile must be used within <ProfileProvider>");
    } finally {
      consoleError.mockRestore();
    }
  });
});
