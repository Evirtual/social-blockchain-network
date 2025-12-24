import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const feedState = { posts: [] as any[] };
  return {
    walletAddress: "0x000000000000000000000000000000000000bEEF" as string | null,
    hasPinata: false,
    setStatus: vi.fn(),
    parseLog: vi.fn() as any,

    createMetadataUri: vi.fn().mockReturnValue("data:application/json;base64,AAAA"),
    fetchTokenMetadata: vi.fn().mockResolvedValue({ name: "", description: "", image: "", animation_url: "" }),
    buildIpfsTokenUri: vi.fn().mockResolvedValue({ tokenUri: "ipfs://meta", imageRef: "ipfs://img", animationRef: "" }),

    receipt: {
      hash: "0xhash",
      logs: [] as any[]
    },

    runContractTx: vi
      .fn()
      .mockImplementation(async (_label: string, send: () => Promise<any>, onReceipt?: (r: any) => any) => {
        await send();

        if (typeof onReceipt === "function") {
          return await onReceipt(mocks.receipt);
        }

        return true;
      }),
    txNotifications: {
      notifyPending: vi.fn(),
      notifyConfirmed: vi.fn(),
      notifyFailed: vi.fn(),
      dismiss: vi.fn()
    },
    writeContract: {
      mintPost: vi.fn().mockResolvedValue({}),
      requestPosterApproval: vi.fn().mockResolvedValue({})
    } as any,
    readContract: {
      isPosterAllowed: vi.fn().mockResolvedValue(true),
      hasPosterRequested: vi.fn().mockResolvedValue(false)
    } as any,
    feedState,
    setPosts: vi.fn((updater: any) => {
      feedState.posts = typeof updater === "function" ? updater(feedState.posts) : updater;
    }),
    refreshFeed: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock("../contracts/socialPosts", () => ({
  socialInterface: {
    parseLog: (args: any) => mocks.parseLog(args)
  }
}));

vi.mock("../ipfs", () => ({
  hasPinata: () => mocks.hasPinata,
  ipfsToHttp: (u: string) => u
}));

vi.mock("../lib/metadata", () => ({
  createMetadataUri: (draft: any) => mocks.createMetadataUri(draft),
  fetchTokenMetadata: (uri: string) => mocks.fetchTokenMetadata(uri)
}));

vi.mock("../lib/ipfsTokenUri", () => ({
  buildIpfsTokenUri: (args: any) => mocks.buildIpfsTokenUri(args)
}));

vi.mock("./WalletContext", () => ({
  useWallet: () => ({ walletAddress: mocks.walletAddress })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./TxNotificationsContext", () => ({
  useTxNotifications: () => mocks.txNotifications
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    getWriteContract: async () => mocks.writeContract,
    getReadContract: async () => mocks.readContract
  })
}));

vi.mock("./FeedContext", () => ({
  useFeed: () => ({
    posts: mocks.feedState.posts,
    setPosts: mocks.setPosts,
    refreshFeed: mocks.refreshFeed
  })
}));

vi.mock("./useContractTx", () => ({
  useContractTx: () => ({ runContractTx: mocks.runContractTx })
}));

import { ComposerProvider, useComposer } from "./ComposerContext";

function grabCtx() {
  let ctx: any;
  function Grabber() {
    ctx = useComposer();
    return null;
  }

  render(
    <ComposerProvider>
      <Grabber />
    </ComposerProvider>
  );

  return () => ctx as ReturnType<typeof useComposer>;
}

beforeEach(() => {
  mocks.walletAddress = "0x000000000000000000000000000000000000bEEF";
  mocks.hasPinata = false;
  mocks.setStatus.mockClear();
  mocks.runContractTx.mockClear();
  mocks.writeContract.mintPost.mockClear();
  mocks.writeContract.requestPosterApproval.mockClear();
  mocks.readContract.isPosterAllowed.mockClear();
  mocks.readContract.isPosterAllowed.mockResolvedValue(true);
  mocks.readContract.hasPosterRequested.mockClear();
  mocks.readContract.hasPosterRequested.mockResolvedValue(false);
  mocks.feedState.posts = [];

  mocks.parseLog.mockReset();
  mocks.createMetadataUri.mockReset();
  mocks.createMetadataUri.mockReturnValue("data:application/json;base64,AAAA");
  mocks.fetchTokenMetadata.mockReset();
  mocks.fetchTokenMetadata.mockResolvedValue({ name: "", description: "", image: "", animation_url: "" });
  mocks.buildIpfsTokenUri.mockReset();
  mocks.buildIpfsTokenUri.mockResolvedValue({ tokenUri: "ipfs://meta", imageRef: "ipfs://img", animationRef: "" });

  mocks.receipt = { hash: "0xhash", logs: [] };
});

describe("ComposerContext transactions", () => {
  it("openComposer and closeComposer toggles open state", async () => {
    const get = grabCtx();
    expect(get().isComposerOpen).toBe(false);

    await act(async () => {
      get().openComposer();
    });
    expect(get().isComposerOpen).toBe(true);

    await act(async () => {
      get().closeComposer();
    });
    expect(get().isComposerOpen).toBe(false);
  });

  it("mintPost requires wallet connection", async () => {
    mocks.walletAddress = null;
    const get = grabCtx();

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
  });

  it("mintPost validates required fields", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Fill out the post text and add an image URL or upload an image.");
  });

  it("mintPost calls contract.mintPost and adds new post to feed", async () => {
    const get = grabCtx();

    mocks.receipt = {
      hash: "0xhash",
      logs: [{ topics: ["t"], data: "0x01" }]
    };
    mocks.parseLog.mockReturnValue({ name: "PostMinted", args: ["0xabc", 99n] });

    await act(async () => {
      get().openComposer();
      get().handleDraftChange("body", "Hello chain");
      get().onComposerImageUrlChange("https://example.com/a.png");
    });

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Mint post NFT", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.mintPost).toHaveBeenCalledWith("data:application/json;base64,AAAA");

    expect(mocks.feedState.posts[0]?.tokenId).toBe("99");
    expect(mocks.feedState.posts[0]?.body).toBe("Hello chain");
    expect(get().isComposerOpen).toBe(false);
    expect(get().draft.body).toBe("");
  });

  it("mintPost returns early when image is still processing", async () => {
    vi.useFakeTimers();
    const get = grabCtx();

    const file = new File(["abc"], "pic.png", { type: "image/png" });

    const originalImage = (globalThis as any).Image;
    class NeverLoadsImage {
      width = 10;
      height = 10;
      decoding: any;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        // error in next tick so we can observe isImageLoading=true before it resolves
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    (globalThis as any).Image = NeverLoadsImage as any;

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => "data:image/jpeg;base64,AAA"
        } as any;
      }
      return originalCreateElement(tag);
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) } as any);

    let pending: Promise<void> | undefined;
    act(() => {
      pending = get().onSelectComposerFile(file);
    });

    await act(async () => {
      await get().mintPost();
    });
    expect(mocks.setStatus).toHaveBeenCalledWith("Please wait for the uploaded image to finish processing.");

    await vi.runAllTimersAsync();
    await pending;

    (globalThis as any).Image = originalImage;
    createElementSpy.mockRestore();
    (globalThis as any).fetch = originalFetch;
    vi.useRealTimers();
  });

  it("mintPost blocks too-large metadata when IPFS is not configured", async () => {
    const get = grabCtx();

    await act(async () => {
      get().openComposer();
      get().handleDraftChange("body", "Hello chain");
      get().onComposerImageUrlChange("https://example.com/a.png");
    });

    mocks.createMetadataUri.mockReturnValue("data:application/json;base64," + "a".repeat(200_000));

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Post metadata is too large to mint on-chain. Use IPFS pinning (recommended via a backend), or use a much smaller image."
    );
    expect(mocks.runContractTx).not.toHaveBeenCalled();
  });

  it("mintPost refreshes feed when mint confirmed but tokenId not parsed", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    mocks.receipt = {
      hash: "0xhash",
      logs: [{ topics: ["t"], data: "0xnope" }]
    };
    mocks.parseLog.mockReturnValue({ name: "OtherEvent", args: [] });
    mocks.buildIpfsTokenUri.mockResolvedValue({ tokenUri: "ipfs://meta", imageRef: "ipfs://img", animationRef: "" });

    await act(async () => {
      get().openComposer();
      get().handleDraftChange("body", "Hello chain");
      get().onComposerImageUrlChange("https://example.com/a.png");
    });

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Mint confirmed, but tokenId could not be parsed. Reloading feed...");
    expect(mocks.refreshFeed).toHaveBeenCalled();
    expect(mocks.txNotifications.dismiss).toHaveBeenCalled();
  });

  it("mintPost IPFS path uploads and finalizes media when tokenUri is ipfs://", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    mocks.receipt = {
      hash: "0xhash",
      logs: [{ topics: ["t"], data: "0xthrow" }, { topics: ["t"], data: "0xok" }]
    };
    mocks.parseLog.mockImplementation(({ data }: any) => {
      if (data === "0xthrow") throw new Error("not ours");
      return { name: "PostMinted", args: ["0xabc", 123n] };
    });
    mocks.buildIpfsTokenUri.mockResolvedValue({ tokenUri: "ipfs://meta", imageRef: "", animationRef: "ipfs://vid" });
    mocks.fetchTokenMetadata.mockResolvedValue({
      name: "n",
      description: "d",
      image: "",
      animation_url: "ipfs://vid"
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true } as any);

    await act(async () => {
      get().openComposer();
      get().handleDraftChange("body", "Hello chain");
      get().onComposerImageUrlChange("https://example.com/a.png");
    });

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.txNotifications.notifyPending).toHaveBeenCalled();
    expect(mocks.txNotifications.notifyConfirmed).toHaveBeenCalled();
    expect(mocks.feedState.posts[0]?.tokenId).toBe("123");
    expect(mocks.feedState.posts[0]?.metadataURI).toBe("ipfs://meta");

    (globalThis as any).fetch = originalFetch;
  });
});

describe("ComposerContext media selection", () => {
  it("ignores null file selection", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().onSelectComposerFile(null);
    });

    expect(get().isImageLoading).toBe(false);
  });

  it("rejects non-image/video file types", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().onSelectComposerFile(new File(["a"], "a.txt", { type: "text/plain" }));
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Please select an image or video file.");
    expect(get().isImageLoading).toBe(false);
  });

  it("rejects video uploads when IPFS is not configured", async () => {
    mocks.hasPinata = false;
    const get = grabCtx();

    await act(async () => {
      await get().onSelectComposerFile(new File(["a"], "a.mp4", { type: "video/mp4" }));
    });

    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Video uploads require IPFS pinning (Pinata). Configure VITE_PINATA_JWT to continue."
    );
  });

  it("accepts video upload when IPFS is configured and revokes preview URLs on clear/url change", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:preview");
    (URL as any).revokeObjectURL = vi.fn();

    await act(async () => {
      await get().onSelectComposerFile(new File(["a"], "a.mp4", { type: "video/mp4" }));
    });
    expect(get().draft.imageDataUrl).toBe("blob:preview");
    expect(get().draft.imageUrl).toBe("");

    await act(async () => {
      get().onComposerClearImage();
    });
    expect(get().draft.imageDataUrl).toBe("");
    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith("blob:preview");

    await act(async () => {
      await get().onSelectComposerFile(new File(["a"], "a.mp4", { type: "video/mp4" }));
    });
    await act(async () => {
      get().onComposerImageUrlChange("https://example.com/img.png");
    });
    expect(get().draft.imageUrl).toBe("https://example.com/img.png");
    expect(get().draft.imageDataUrl).toBe("");
    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith("blob:preview");

    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
  });

  it("revokes the previous preview URL when selecting a new video", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValueOnce("blob:one").mockReturnValueOnce("blob:two");
    (URL as any).revokeObjectURL = vi.fn();

    await act(async () => {
      await get().onSelectComposerFile(new File(["a"], "a.mp4", { type: "video/mp4" }));
      await get().onSelectComposerFile(new File(["b"], "b.mp4", { type: "video/mp4" }));
    });

    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(get().draft.imageDataUrl).toBe("blob:two");

    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
  });

  it("uses a default filename for unnamed video uploads", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:preview");
    (URL as any).revokeObjectURL = vi.fn();

    await act(async () => {
      await get().onSelectComposerFile(new File(["a"], "", { type: "video/mp4" }));
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Uploaded video ready.");

    mocks.receipt = {
      hash: "0xhash",
      logs: [{ topics: ["t"], data: "0xok" }]
    };
    mocks.parseLog.mockReturnValue({ name: "PostMinted", args: ["0xabc", 1n] });
    mocks.buildIpfsTokenUri.mockResolvedValue({ tokenUri: "ipfs://meta", imageRef: "", animationRef: "ipfs://vid" });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true } as any);

    await act(async () => {
      get().handleDraftChange("body", "Hello chain");
      await get().mintPost();
    });

    (globalThis as any).fetch = originalFetch;

    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
  });

  it("processes an image upload into a jpeg data URL", async () => {
    const get = grabCtx();

    const originalImage = (globalThis as any).Image;
    class LoadsImage {
      width = 10;
      height = 10;
      decoding: any;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    (globalThis as any).Image = LoadsImage as any;

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:img");
    (URL as any).revokeObjectURL = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => "data:image/jpeg;base64,AAA"
        } as any;
      }
      return originalCreateElement(tag);
    });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) } as any);

    vi.useFakeTimers();
    await act(async () => {
      const task = get().onSelectComposerFile(new File(["a"], "a.png", { type: "image/png" }));
      await vi.runAllTimersAsync();
      await task;
    });
    vi.useRealTimers();

    expect(get().draft.imageDataUrl.startsWith("data:image/jpeg")).toBe(true);
    expect(get().draft.imageUrl).toBe("");
    expect(mocks.setStatus).toHaveBeenCalledWith("Uploaded image ready.");

    (globalThis as any).Image = originalImage;
    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
    createElementSpy.mockRestore();
    (globalThis as any).fetch = originalFetch;
  });

    it("uses a default filename for unnamed image uploads", async () => {
      mocks.hasPinata = true;
      const get = grabCtx();

      const originalImage = (globalThis as any).Image;
      class LoadsImage {
        width = 10;
        height = 10;
        decoding: any;
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        set src(_v: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      (globalThis as any).Image = LoadsImage as any;

      const originalCreateObjectURL = (URL as any).createObjectURL;
      const originalRevokeObjectURL = (URL as any).revokeObjectURL;
      (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:img");
      (URL as any).revokeObjectURL = vi.fn();

      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: vi.fn() }),
            toDataURL: () => "data:image/jpeg;base64,AAA"
          } as any;
        }
        return originalCreateElement(tag);
      });

      const originalFetch = globalThis.fetch;
      (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) } as any);

      // Use a non-ipfs tokenUri so we don't enter the finalization polling section.
      mocks.buildIpfsTokenUri.mockResolvedValueOnce({ tokenUri: "data:meta", imageRef: "ipfs://img", animationRef: "" });

      mocks.receipt = {
        hash: "0xhash",
        logs: [{ topics: ["t"], data: "0xok" }]
      };
      mocks.parseLog.mockReturnValue({ name: "PostMinted", args: ["0xabc", 1n] });

      vi.useFakeTimers();
      await act(async () => {
        const task = get().onSelectComposerFile(new File(["a"], "", { type: "image/png" }));
        await vi.runAllTimersAsync();
        await task;
      });
      vi.useRealTimers();

      await act(async () => {
        get().openComposer();
        get().handleDraftChange("body", "Hello chain");
      });

      await act(async () => {
        await get().mintPost();
      });

      expect(mocks.buildIpfsTokenUri).toHaveBeenCalledWith(expect.objectContaining({ imageFilename: "post-image.jpg" }));

      (globalThis as any).Image = originalImage;
      if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
      else delete (URL as any).createObjectURL;
      if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
      else delete (URL as any).revokeObjectURL;
      createElementSpy.mockRestore();
      (globalThis as any).fetch = originalFetch;
    });

  it("rejects images that remain too large after compression", async () => {
    const get = grabCtx();

    const originalImage = (globalThis as any).Image;
    class LoadsImage {
      width = 5000;
      height = 5000;
      decoding: any;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    (globalThis as any).Image = LoadsImage as any;

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:img");
    (URL as any).revokeObjectURL = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => "data:image/jpeg;base64," + "a".repeat(120_000)
        } as any;
      }
      return originalCreateElement(tag);
    });

    vi.useFakeTimers();
    await act(async () => {
      const task = get().onSelectComposerFile(new File(["a"], "a.png", { type: "image/png" }));
      await vi.runAllTimersAsync();
      await task;
    });
    vi.useRealTimers();

    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Uploaded image is too large to embed on-chain. Use a smaller image, or paste an image URL (recommended: IPFS/http)."
    );

    (globalThis as any).Image = originalImage;
    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
    createElementSpy.mockRestore();
  });

  it("fails when canvas is not supported", async () => {
    const get = grabCtx();

    const originalImage = (globalThis as any).Image;
    class LoadsImage {
      width = 10;
      height = 10;
      decoding: any;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    (globalThis as any).Image = LoadsImage as any;

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:img");
    (URL as any).revokeObjectURL = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => null,
          toDataURL: () => "data:image/jpeg;base64,AAA"
        } as any;
      }
      return originalCreateElement(tag);
    });

    vi.useFakeTimers();
    await act(async () => {
      const task = get().onSelectComposerFile(new File(["a"], "a.png", { type: "image/png" }));
      await vi.runAllTimersAsync();
      await task;
    });
    vi.useRealTimers();

    expect(mocks.setStatus).toHaveBeenCalledWith("Failed to read image.");

    (globalThis as any).Image = originalImage;
    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
    createElementSpy.mockRestore();
  });

  it("handles image decode failures", async () => {
    const get = grabCtx();

    const originalImage = (globalThis as any).Image;
    class FailsImage {
      width = 10;
      height = 10;
      decoding: any;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    (globalThis as any).Image = FailsImage as any;

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:img");
    (URL as any).revokeObjectURL = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: any) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => "data:image/jpeg;base64,AAA"
        } as any;
      }
      return originalCreateElement(tag);
    });

    vi.useFakeTimers();
    await act(async () => {
      const task = get().onSelectComposerFile(new File(["a"], "a.png", { type: "image/png" }));
      await vi.runAllTimersAsync();
      await task;
    });
    vi.useRealTimers();

    expect(mocks.setStatus).toHaveBeenCalledWith("Failed to read image.");

    (globalThis as any).Image = originalImage;
    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
    createElementSpy.mockRestore();
  });
});

describe("ComposerContext IPFS finalization branches", () => {
  it("waits/retries for metadata and reachability (including failure paths) and skips mediaRef wait when empty", async () => {
    vi.useFakeTimers();
    mocks.hasPinata = true;
    const get = grabCtx();

    const originalSetTimeout = window.setTimeout;
    // Force the outer catch-path in waitForUrlReachable by throwing when it schedules its 2500ms abort timer.
    (window as any).setTimeout = ((fn: any, ms: any, ...args: any[]) => {
      if (ms === 2500) throw new Error("timer blocked");
      return originalSetTimeout(fn, ms, ...args);
    }) as any;

    // Make reachability probes fail so we hit the retry+sleep path.
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error("network down"));

    // Force metadata polling loop to exhaust attempts (no string fields), then return a final meta with empty media.
    mocks.fetchTokenMetadata.mockReset();
    for (let i = 0; i < 10; i++) {
      mocks.fetchTokenMetadata.mockResolvedValueOnce({ name: null, description: null, image: null, animation_url: null } as any);
    }
    mocks.fetchTokenMetadata.mockResolvedValueOnce({ name: "", description: "", image: "", animation_url: "" } as any);

    mocks.receipt = {
      hash: "0xhash",
      logs: [{ topics: ["t"], data: "0x01" }]
    };
    mocks.parseLog.mockReturnValue({ name: "PostMinted", args: ["0xabc", 123n] });

    await act(async () => {
      get().openComposer();
      get().handleDraftChange("body", "Hello chain");
      get().onComposerImageUrlChange("https://example.com/a.png");
    });

    let pending: Promise<void> | undefined;
    act(() => {
      pending = get().mintPost();
    });

    await vi.runAllTimersAsync();
    await act(async () => {
      await pending;
    });

    (globalThis as any).fetch = originalFetch;
    (window as any).setTimeout = originalSetTimeout;
    vi.useRealTimers();
  });
});

describe("ComposerContext post-mint cleanup", () => {
  it("revokes video preview URL after a successful mint", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:preview");
    (URL as any).revokeObjectURL = vi.fn();

    // Avoid the finalization polling section by returning a non-ipfs tokenUri.
    mocks.buildIpfsTokenUri.mockResolvedValueOnce({ tokenUri: "data:meta", imageRef: "", animationRef: "" });

    mocks.receipt = {
      hash: "0xhash",
      logs: [{ topics: ["t"], data: "0x01" }]
    };
    mocks.parseLog.mockReturnValue({ name: "PostMinted", args: ["0xabc", 1n] });

    await act(async () => {
      get().openComposer();
      await get().onSelectComposerFile(new File(["a"], "a.mp4", { type: "video/mp4" }));
      get().handleDraftChange("body", "Hello chain");
    });

    await act(async () => {
      await get().mintPost();
    });

    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith("blob:preview");

    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
  });

  it("reports errors thrown during mintPost", async () => {
    const get = grabCtx();
    mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

    await act(async () => {
      get().openComposer();
      get().handleDraftChange("body", "Hello chain");
      get().onComposerImageUrlChange("https://example.com/a.png");
    });

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.runContractTx).toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith("boom");
  });
});

describe("ComposerContext IPFS finalization branches", () => {
  it("uses GET range when HEAD not ok and falls back to meta.image", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    mocks.receipt = {
      hash: "0xhash",
      logs: [{ topics: ["t"], data: "0xok" }]
    };
    mocks.parseLog.mockReturnValue({ name: "PostMinted", args: ["0xabc", 777n] });
    mocks.buildIpfsTokenUri.mockResolvedValue({ tokenUri: "ipfs://meta", imageRef: "ipfs://img", animationRef: "" });
    mocks.fetchTokenMetadata.mockResolvedValue({ name: "n", description: "d", image: "ipfs://img", animation_url: "" });

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    await act(async () => {
      get().openComposer();
      get().handleDraftChange("body", "Hello chain");
      get().onComposerImageUrlChange("https://example.com/a.png");
    });

    await act(async () => {
      await get().mintPost();
    });

    expect(mocks.feedState.posts[0]?.tokenId).toBe("777");
    expect(mocks.txNotifications.notifyConfirmed).toHaveBeenCalled();
    expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThanOrEqual(2);

    (globalThis as any).fetch = originalFetch;
  });

    it("handles fetch failures during reachability probes (HEAD/GET catch paths)", async () => {
      vi.useFakeTimers();
      mocks.hasPinata = true;
      const get = grabCtx();

      mocks.receipt = {
        hash: "0xhash",
        logs: [{ topics: ["t"], data: "0xok" }]
      };
      mocks.parseLog.mockReturnValue({ name: "PostMinted", args: ["0xabc", 888n] });
      mocks.buildIpfsTokenUri.mockResolvedValue({ tokenUri: "ipfs://meta", imageRef: "ipfs://img", animationRef: "" });
      mocks.fetchTokenMetadata.mockResolvedValue({ name: "n", description: "d", image: "ipfs://img", animation_url: "" });

      const originalFetch = globalThis.fetch;
      (globalThis as any).fetch = vi
        .fn()
        // metadataURI reachability: fail HEAD+GET once, then succeed
        .mockRejectedValueOnce(new Error("head down"))
        .mockRejectedValueOnce(new Error("get down"))
        .mockResolvedValueOnce({ ok: true } as any)
        // mediaRef reachability: fail HEAD+GET once, then succeed
        .mockRejectedValueOnce(new Error("head down"))
        .mockRejectedValueOnce(new Error("get down"))
        .mockResolvedValueOnce({ ok: true } as any);

      await act(async () => {
        get().openComposer();
        get().handleDraftChange("body", "Hello chain");
        get().onComposerImageUrlChange("https://example.com/a.png");
      });

      let pending: Promise<void> | undefined;
      act(() => {
        pending = get().mintPost();
      });

      await vi.runAllTimersAsync();
      await act(async () => {
        await pending;
      });

      expect(mocks.feedState.posts[0]?.tokenId).toBe("888");

      (globalThis as any).fetch = originalFetch;
      vi.useRealTimers();
    });
});

  describe("useComposer", () => {
    it("throws when used outside the provider", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      function Grabber() {
        useComposer();
        return null;
      }

      expect(() => render(<Grabber />)).toThrow(/useComposer must be used within <ComposerProvider>/);

      consoleError.mockRestore();
    });
  });
