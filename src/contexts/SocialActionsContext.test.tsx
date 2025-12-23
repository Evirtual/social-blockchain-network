import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mutable mock state shared with module mocks.
const mocks = vi.hoisted(() => {
  const feedState = {
    posts: [
      {
        tokenId: "1",
        title: "t",
        body: "Hello",
        image: "https://example.com/img.png",
        metadataURI: "meta",
        author: "0x000000000000000000000000000000000000dEaD",
        likes: 0,
        comments: 0,
        shares: 0,
        tipsWei: 0n,
        likedByMe: false,
        repostedByMe: false
      }
    ] as any[],
    postComments: {} as Record<string, any[]>
  };

  return {
    walletAddress: "0x000000000000000000000000000000000000bEEF" as string | null,
    refreshWalletPanel: vi.fn(),
    setStatus: vi.fn(),

    // Contract
    readContract: {
      isPostFrozen: vi.fn().mockResolvedValue(false)
    } as any,
    writeContract: {
      freezePost: vi.fn().mockResolvedValue({}),
      updatePostURI: vi.fn().mockResolvedValue({}),
      burnPost: vi.fn().mockResolvedValue({}),
      tipPost: vi.fn().mockResolvedValue({}),
      withdrawTips: vi.fn().mockResolvedValue({}),
      commentPost: vi.fn().mockResolvedValue({}),
      likePost: vi.fn().mockResolvedValue({}),
      unlikePost: vi.fn().mockResolvedValue({}),
      sharePost: vi.fn().mockResolvedValue({}),
      unsharePost: vi.fn().mockResolvedValue({}),
      hasLiked: vi.fn().mockResolvedValue(false),
      hasShared: vi.fn().mockResolvedValue(false)
    } as any,

    // Feed
    feedState,
    refreshFeed: vi.fn().mockResolvedValue(undefined),
    loadCommentsForPost: vi.fn().mockResolvedValue(undefined),
    setPosts: vi.fn((updater: any) => {
      feedState.posts = typeof updater === "function" ? updater(feedState.posts) : updater;
    }),
    setPostComments: vi.fn((updater: any) => {
      feedState.postComments = typeof updater === "function" ? updater(feedState.postComments) : updater;
    }),

    runContractTx: vi
      .fn()
      .mockImplementation(async (_label: string, send: () => Promise<any>, onReceipt?: (r: any) => any) => {
        await send();
        if (onReceipt) return await onReceipt({ hash: "0xhash", logs: [] });
        return true;
      })
  };
});

vi.mock("../ipfs", () => ({
  hasPinata: () => false
}));

vi.mock("../lib/metadata", () => ({
  createMetadataUri: () => "data:application/json;base64,AAAA"
}));

vi.mock("./WalletContext", () => ({
  useWallet: () => ({
    walletAddress: mocks.walletAddress,
    refreshWalletPanel: mocks.refreshWalletPanel
  })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    getReadContract: async () => mocks.readContract,
    getWriteContract: async () => mocks.writeContract
  })
}));

vi.mock("./FeedContext", () => ({
  useFeed: () => ({
    posts: mocks.feedState.posts,
    setPosts: mocks.setPosts,
    postComments: mocks.feedState.postComments,
    setPostComments: mocks.setPostComments,
    refreshFeed: mocks.refreshFeed,
    loadCommentsForPost: mocks.loadCommentsForPost
  })
}));

vi.mock("./useContractTx", () => ({
  useContractTx: () => ({ runContractTx: mocks.runContractTx })
}));

import { SocialActionsProvider, useSocialActions } from "./SocialActionsContext";

function grabCtx() {
  let ctx: any;
  function Grabber() {
    ctx = useSocialActions();
    return null;
  }

  render(
    <SocialActionsProvider>
      <Grabber />
    </SocialActionsProvider>
  );

  return () => ctx as ReturnType<typeof useSocialActions>;
}

beforeEach(() => {
  mocks.walletAddress = "0x000000000000000000000000000000000000bEEF";
  mocks.setStatus.mockClear();
  mocks.refreshWalletPanel.mockClear();
  mocks.runContractTx.mockClear();
  mocks.refreshFeed.mockClear();
  mocks.loadCommentsForPost.mockClear();

  Object.values(mocks.writeContract).forEach((v) => {
    if (typeof v === "function" && "mockClear" in v) (v as any).mockClear();
  });
  mocks.writeContract.hasLiked.mockResolvedValue(false);
  mocks.writeContract.hasShared.mockResolvedValue(false);

  mocks.feedState.posts = [
    {
      tokenId: "1",
      title: "t",
      body: "Hello",
      image: "https://example.com/img.png",
      metadataURI: "meta",
      author: "0x000000000000000000000000000000000000dEaD",
      likes: 0,
      comments: 0,
      shares: 0,
      tipsWei: 0n,
      likedByMe: false,
      repostedByMe: false
    }
  ] as any[];
});

describe("SocialActionsContext transactions", () => {
  it("handleTip requires wallet connection", async () => {
    mocks.walletAddress = null;
    const get = grabCtx();

    await act(async () => {
      await get().handleTip("1");
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
  });

  it("handleTip validates numeric input", async () => {
    const get = grabCtx();

    await act(async () => {
      get().onTipDraftChange("1", "abc");
    });
    await act(async () => {
      await get().handleTip("1");
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Enter a valid tip amount.");
    expect(mocks.writeContract.tipPost).not.toHaveBeenCalled();
  });

  it("handleTip sends tipPost and clears draft", async () => {
    const get = grabCtx();

    await act(async () => {
      get().onTipDraftChange("1", "0.01");
    });
    await act(async () => {
      await get().handleTip("1");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Tip", expect.any(Function));
    expect(mocks.writeContract.tipPost).toHaveBeenCalledWith(1n, { value: expect.anything() });
    expect(typeof mocks.writeContract.tipPost.mock.calls[0]?.[1]?.value).toBe("bigint");
    expect(get().tipDrafts["1"]).toBe("");
    expect(mocks.refreshWalletPanel).toHaveBeenCalled();
  });

  it("handleAction comment requires a draft", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().handleAction("1", "comment");
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Write a comment before signing.");
    expect(mocks.writeContract.commentPost).not.toHaveBeenCalled();
  });

  it("handleAction comment sends commentPost and increments local count", async () => {
    const get = grabCtx();

    await act(async () => {
      get().onCommentDraftChange("1", "Nice post!");
    });
    await act(async () => {
      await get().handleAction("1", "comment");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Comment", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.commentPost).toHaveBeenCalledWith(1n, "Nice post!");

    // Post list updated.
    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.comments).toBe(1);

    // Draft cleared + comments load kicked.
    expect(get().commentDrafts["1"]).toBe("");
    await waitFor(() => expect(mocks.loadCommentsForPost).toHaveBeenCalledWith("1"));
  });

  it("handleAction like calls likePost when not yet liked", async () => {
    const get = grabCtx();
    mocks.writeContract.hasLiked.mockResolvedValue(false);

    await act(async () => {
      await get().handleAction("1", "like");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Like", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.likePost).toHaveBeenCalledWith(1n);

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.likes).toBe(1);
    expect(updated.likedByMe).toBe(true);
  });

  it("handleAction like calls unlikePost when already liked", async () => {
    const get = grabCtx();
    mocks.writeContract.hasLiked.mockResolvedValue(true);

    // Seed state as liked to verify decrement.
    mocks.feedState.posts[0].likes = 2;
    mocks.feedState.posts[0].likedByMe = true;

    await act(async () => {
      await get().handleAction("1", "like");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Unlike", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.unlikePost).toHaveBeenCalledWith(1n);

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.likes).toBe(1);
    expect(updated.likedByMe).toBe(false);
  });

  it("handleAction share calls sharePost when not yet shared", async () => {
    const get = grabCtx();
    mocks.writeContract.hasShared.mockResolvedValue(false);

    await act(async () => {
      await get().handleAction("1", "share");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Save", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.sharePost).toHaveBeenCalledWith(1n);

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.shares).toBe(1);
    expect(updated.repostedByMe).toBe(true);
  });

  it("saveEditedPost calls updatePostURI and refreshes feed", async () => {
    const get = grabCtx();

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0] as any);
    });

    await waitFor(() => expect(get().editingTokenId).toBe("1"));

    await act(async () => {
      get().setEditDraft((prev) => ({ ...prev, body: "Updated", imageUrl: "https://example.com/new.png" }));
    });

    await act(async () => {
      await get().saveEditedPost();
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Edit post", expect.any(Function));
    expect(mocks.writeContract.updatePostURI).toHaveBeenCalledWith(1n, expect.any(String));
    expect(mocks.refreshFeed).toHaveBeenCalled();
    expect(get().editingTokenId).toBe(null);
  });

  it("burnPost calls burnPost and removes local post", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().burnPost("1");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Burn post", expect.any(Function));
    expect(mocks.writeContract.burnPost).toHaveBeenCalledWith(1n);
    expect(mocks.feedState.posts.find((p) => p.tokenId === "1")).toBeUndefined();
    expect(mocks.refreshFeed).toHaveBeenCalled();
  });

  it("withdrawTips calls withdrawTips", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().withdrawTips();
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Withdraw tips", expect.any(Function));
    expect(mocks.writeContract.withdrawTips).toHaveBeenCalled();
    expect(mocks.refreshWalletPanel).toHaveBeenCalled();
  });

  it("freezePost calls freezePost", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().freezePost("1");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Freeze post", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.freezePost).toHaveBeenCalledWith(1n);
    expect(mocks.setStatus).toHaveBeenCalledWith("Post frozen. Editing is now disabled for this token.");
  });
});
