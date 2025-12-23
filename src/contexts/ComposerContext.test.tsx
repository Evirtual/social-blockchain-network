import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const feedState = { posts: [] as any[] };
  return {
    walletAddress: "0x000000000000000000000000000000000000bEEF" as string | null,
    setStatus: vi.fn(),
    runContractTx: vi
      .fn()
      .mockImplementation(async (_label: string, send: () => Promise<any>, _onReceipt?: (r: any) => any) => {
        await send();
        return { mintedTokenId: "99", mintedAuthor: "0xabc", mintTxHash: "0xhash" };
      }),
    txNotifications: {
      notifyPending: vi.fn(),
      notifyConfirmed: vi.fn(),
      notifyFailed: vi.fn(),
      dismiss: vi.fn()
    },
    writeContract: {
      mintPost: vi.fn().mockResolvedValue({})
    } as any,
    feedState,
    setPosts: vi.fn((updater: any) => {
      feedState.posts = typeof updater === "function" ? updater(feedState.posts) : updater;
    }),
    refreshFeed: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock("../ipfs", () => ({
  hasPinata: () => false,
  ipfsToHttp: (u: string) => u
}));

vi.mock("../lib/metadata", () => ({
  createMetadataUri: () => "data:application/json;base64,AAAA",
  fetchTokenMetadata: vi.fn().mockResolvedValue({ name: "", description: "", image: "" })
}));

vi.mock("../lib/ipfsTokenUri", () => ({
  buildIpfsTokenUri: vi.fn()
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
    getWriteContract: async () => mocks.writeContract
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
  mocks.setStatus.mockClear();
  mocks.runContractTx.mockClear();
  mocks.writeContract.mintPost.mockClear();
  mocks.feedState.posts = [];
});

describe("ComposerContext transactions", () => {
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
});
