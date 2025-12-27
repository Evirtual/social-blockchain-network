import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildIpfsTokenUri } from "../lib/ipfsTokenUri";

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
    chainId: "0x1" as string | null,
    isOwner: false,
    refreshWalletPanel: vi.fn(),
    setStatus: vi.fn(),

    hasPinata: false,
    metadataUri: "data:application/json;base64,AAAA",
    ipfsTokenUri: "ipfs://token",

    // Contract
    readContract: {
      isPostFrozen: vi.fn().mockResolvedValue(false)
    } as any,
    writeContract: {
      freezePost: vi.fn().mockResolvedValue({}),
      updatePostURI: vi.fn().mockResolvedValue({}),
      adminUpdatePostURI: vi.fn().mockResolvedValue({}),
      burnPost: vi.fn().mockResolvedValue({}),
      adminBurnPost: vi.fn().mockResolvedValue({}),
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
      }),

    txNotifications: {
      notifySigning: vi.fn(),
      notifyPending: vi.fn(),
      notifyConfirmed: vi.fn(),
      notifyFailed: vi.fn(),
      notifyCancelled: vi.fn(),
      dismiss: vi.fn()
    }
  };
});

vi.mock("../ipfs", () => ({
  hasPinata: () => mocks.hasPinata
}));

vi.mock("../lib/metadata", () => ({
  createMetadataUri: (...args: any[]) => {
    const v: any = (mocks as any).metadataUri;
    return typeof v === "function" ? v(...args) : v;
  }
}));

vi.mock("../lib/ipfsTokenUri", () => ({
  buildIpfsTokenUri: vi.fn(async () => ({ tokenUri: mocks.ipfsTokenUri }))
}));

vi.mock("./WalletContext", () => ({
  useWallet: () => ({
    walletAddress: mocks.walletAddress,
    chainId: mocks.chainId,
    refreshWalletPanel: mocks.refreshWalletPanel
  })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    isOwner: mocks.isOwner,
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

vi.mock("./TxNotificationsContext", () => ({
  useTxNotifications: () => mocks.txNotifications,
  isUserRejectedTx: () => false
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
  mocks.chainId = "0x1";
  mocks.isOwner = false;
  mocks.setStatus.mockClear();
  mocks.refreshWalletPanel.mockClear();
  mocks.runContractTx.mockClear();
  mocks.refreshFeed.mockClear();
  mocks.loadCommentsForPost.mockClear();

  Object.values(mocks.txNotifications).forEach((v) => {
    if (typeof v === "function" && "mockClear" in v) (v as any).mockClear();
  });

  mocks.hasPinata = false;
  mocks.metadataUri = "data:application/json;base64,AAAA";
  mocks.ipfsTokenUri = "ipfs://token";

  (buildIpfsTokenUri as any).mockClear?.();

  mocks.readContract.isPostFrozen.mockReset();
  mocks.readContract.isPostFrozen.mockResolvedValue(false);

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
  it("blocks actions on wrong network and falls back to chainId label when unknown", async () => {
    const get = grabCtx();
    mocks.chainId = "0x1";

    await act(async () => {
      await get().freezePost("1", "999999");
    });

    expect(mocks.writeContract.freezePost).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Wrong network. Switch to #999999 to interact with this post."
    );
  });

  it("burnPost returns early on wrong network", async () => {
    mocks.chainId = "0x1";
    const get = grabCtx();

    await act(async () => {
      await get().burnPost("1", "999999");
    });

    expect(mocks.writeContract.burnPost).not.toHaveBeenCalled();
    expect(mocks.writeContract.adminBurnPost).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Wrong network. Switch to #999999 to interact with this post."
    );
  });

  it("burnPost keeps other posts when removing one", async () => {
    mocks.chainId = "0x1";
    mocks.feedState.posts = [
      {
        tokenId: "1",
        title: "t1",
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
      },
      {
        tokenId: "2",
        title: "t2",
        body: "World",
        image: "https://example.com/img2.png",
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

    const get = grabCtx();

    await act(async () => {
      await get().burnPost("1");
    });

    expect(mocks.feedState.posts.map((p) => p.tokenId)).toEqual(["2"]);
  });

  it("handleTip returns early on wrong network", async () => {
    mocks.chainId = "0x1";
    const get = grabCtx();

    await act(async () => {
      get().onTipDraftChange("1", "1");
    });

    await act(async () => {
      await get().handleTip("1", "999999");
    });

    expect(mocks.writeContract.tipPost).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Wrong network. Switch to #999999 to interact with this post."
    );
  });

  it("handleAction returns early on wrong network", async () => {
    mocks.chainId = "0x1";
    const get = grabCtx();

    await act(async () => {
      await get().handleAction("1", "like", "999999");
    });

    expect(mocks.writeContract.likePost).not.toHaveBeenCalled();
    expect(mocks.writeContract.unlikePost).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Wrong network. Switch to #999999 to interact with this post."
    );
  });

  it("comment updates only the matching chain when tokenIds collide", async () => {
    mocks.chainId = "11155111";
    mocks.feedState.posts = [
      {
        tokenId: "1",
        chainId: "11155111",
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
      },
      {
        tokenId: "1",
        chainId: "84532",
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

    const get = grabCtx();

    await act(async () => {
      get().onCommentDraftChange("1", "Nice");
    });

    await act(async () => {
      await get().handleAction("1", "comment", "11155111");
    });

    expect(mocks.feedState.posts[0].comments).toBe(1);
    expect(mocks.feedState.posts[1].comments).toBe(0);
  });

  it("share updates only the matching chain when tokenIds collide", async () => {
    mocks.chainId = "11155111";
    mocks.writeContract.hasShared.mockResolvedValue(false);
    mocks.feedState.posts = [
      {
        tokenId: "1",
        chainId: "11155111",
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
      },
      {
        tokenId: "1",
        chainId: "84532",
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

    const get = grabCtx();

    await act(async () => {
      await get().handleAction("1", "share", "11155111");
    });

    expect(mocks.feedState.posts[0].shares).toBe(1);
    expect(mocks.feedState.posts[0].repostedByMe).toBe(true);
    expect(mocks.feedState.posts[1].shares).toBe(0);
  });

  it("allows actions when wallet chainId is missing", async () => {
    mocks.chainId = null;
    const get = grabCtx();

    await act(async () => {
      await get().freezePost("1", "1");
    });

    expect(mocks.writeContract.freezePost).toHaveBeenCalledWith(1n);
    expect(mocks.setStatus).not.toHaveBeenCalledWith(expect.stringContaining("Wrong network"));
  });

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

  it("handleTip uses empty-draft fallbacks", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().handleTip("1");
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Enter a valid tip amount.");
    expect(mocks.writeContract.tipPost).not.toHaveBeenCalled();
  });

  it("handleTip sends tipPost and clears draft", async () => {
    const get = grabCtx();

    // Ensure we cover the non-matching branch in feed.setPosts map.
    mocks.feedState.posts = [
      ...mocks.feedState.posts,
      {
        tokenId: "2",
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

    await act(async () => {
      get().onTipDraftChange("1", "0.01");
    });
    await act(async () => {
      await get().handleTip("1");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Tip", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.tipPost).toHaveBeenCalledWith(1n, { value: expect.anything() });
    expect(typeof mocks.writeContract.tipPost.mock.calls[0]?.[1]?.value).toBe("bigint");
    expect(get().tipDrafts["1"]).toBe("");
    expect(mocks.refreshWalletPanel).toHaveBeenCalled();
  });

  it("handleTip returns early when tx returns ok=false", async () => {
    const get = grabCtx();
    mocks.runContractTx.mockResolvedValueOnce(false);

    mocks.feedState.posts = [
      {
        ...mocks.feedState.posts[0],
        tokenId: "1",
        tipsWei: 0n
      }
    ] as any[];

    await act(async () => {
      get().onTipDraftChange("1", "0.01");
    });
    await act(async () => {
      const ok = await get().handleTip("1");
      expect(ok).toBe(false);
    });

    const updated = mocks.feedState.posts.find((p: any) => p.tokenId === "1");
    expect(updated.tipsWei).toBe(0n);
    expect(get().tipDrafts["1"]).toBe("0.01");
  });

  it("handleTip only updates posts on matching postChainId", async () => {
    const get = grabCtx();
    mocks.chainId = "1";

    mocks.feedState.posts = [
      {
        ...mocks.feedState.posts[0],
        chainId: "1",
        tipsWei: 0n
      },
      {
        ...mocks.feedState.posts[0],
        chainId: "8453",
        tipsWei: 0n
      }
    ] as any[];

    await act(async () => {
      get().onTipDraftChange("1", "0.01");
    });
    await act(async () => {
      await get().handleTip("1", "1");
    });

    const onEth = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "1");
    const onBase = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "8453");
    expect(onEth.tipsWei).toBeGreaterThan(0n);
    expect(onBase.tipsWei).toBe(0n);
  });

  it("handleTip updates post when postChainId is provided but post has no chainId", async () => {
    const get = grabCtx();
    mocks.chainId = "1";

    mocks.feedState.posts = [
      {
        ...mocks.feedState.posts[0],
        chainId: undefined,
        tipsWei: 0n
      }
    ] as any[];

    await act(async () => {
      get().onTipDraftChange("1", "0.01");
    });
    await act(async () => {
      await get().handleTip("1", "1");
    });

    const updated = mocks.feedState.posts.find((p: any) => p.tokenId === "1");
    expect(updated.tipsWei).toBeGreaterThan(0n);
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

    // Ensure we cover the non-matching branch in feed.setPosts map.
    mocks.feedState.posts = [
      ...mocks.feedState.posts,
      {
        tokenId: "2",
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

  it("handleAction comment returns early when tx returns ok=false", async () => {
    const get = grabCtx();
    mocks.runContractTx.mockResolvedValueOnce(false);

    await act(async () => {
      get().onCommentDraftChange("1", "Nice post!");
    });
    await act(async () => {
      await get().handleAction("1", "comment");
    });

    expect(get().commentDrafts["1"]).toBe("Nice post!");
  });

  it("handleAction like calls likePost when not yet liked", async () => {
    const get = grabCtx();
    mocks.writeContract.hasLiked.mockResolvedValue(false);

    // Ensure we cover the non-matching branch in feed.setPosts map.
    mocks.feedState.posts = [
      ...mocks.feedState.posts,
      {
        tokenId: "2",
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

  it("handleAction like clamps likes at zero when unliking", async () => {
    const get = grabCtx();
    mocks.writeContract.hasLiked.mockResolvedValue(true);

    // Seed state as liked but with 0 likes to hit Math.max clamp.
    mocks.feedState.posts[0].likes = 0;
    mocks.feedState.posts[0].likedByMe = true;

    await act(async () => {
      await get().handleAction("1", "like");
    });

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.likes).toBe(0);
    expect(updated.likedByMe).toBe(false);
  });

  it("handleAction returns false for unknown action", async () => {
    const get = grabCtx();

    await act(async () => {
      const ok = await get().handleAction("1", "nope" as any);
      expect(ok).toBe(false);
    });
  });

  it("handleAction like only updates posts on matching postChainId", async () => {
    mocks.chainId = "1";
    const get = grabCtx();
    mocks.writeContract.hasLiked.mockResolvedValue(false);

    mocks.feedState.posts = [
      {
        ...mocks.feedState.posts[0],
        chainId: "1",
        likes: 0,
        likedByMe: false
      },
      {
        ...mocks.feedState.posts[0],
        chainId: "8453",
        likes: 0,
        likedByMe: false
      }
    ] as any[];

    await act(async () => {
      await get().handleAction("1", "like", "1");
    });

    const onEth = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "1");
    const onBase = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "8453");
    expect(onEth.likes).toBe(1);
    expect(onBase.likes).toBe(0);
  });

  it("handleAction like does not update posts when tx fails", async () => {
    const get = grabCtx();
    mocks.writeContract.hasLiked.mockResolvedValue(false);
    mocks.runContractTx.mockResolvedValueOnce(false);

    await act(async () => {
      await get().handleAction("1", "like");
    });

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.likes).toBe(0);
    expect(updated.likedByMe).toBe(false);
  });

  it("handleAction share calls sharePost when not yet shared", async () => {
    const get = grabCtx();
    mocks.writeContract.hasShared.mockResolvedValue(false);

    // Ensure we cover the non-matching branch in feed.setPosts map.
    mocks.feedState.posts = [
      ...mocks.feedState.posts,
      {
        tokenId: "2",
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

    await act(async () => {
      await get().handleAction("1", "share");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Save", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.sharePost).toHaveBeenCalledWith(1n);

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.shares).toBe(1);
    expect(updated.repostedByMe).toBe(true);
  });

  it("handleAction share calls unsharePost when already shared", async () => {
    const get = grabCtx();
    mocks.writeContract.hasShared.mockResolvedValue(true);
    mocks.feedState.posts[0].shares = 2;
    mocks.feedState.posts[0].repostedByMe = true;

    await act(async () => {
      await get().handleAction("1", "share");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Unsave", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.unsharePost).toHaveBeenCalledWith(1n);

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.shares).toBe(1);
    expect(updated.repostedByMe).toBe(false);
  });

  it("handleAction share does not update posts when tx fails", async () => {
    const get = grabCtx();
    mocks.writeContract.hasShared.mockResolvedValue(false);
    mocks.runContractTx.mockResolvedValueOnce(false);

    await act(async () => {
      await get().handleAction("1", "share");
    });

    const updated = mocks.feedState.posts.find((p) => p.tokenId === "1");
    expect(updated.shares).toBe(0);
    expect(updated.repostedByMe).toBe(false);
  });

  it("startEditPost blocks editing when post is frozen", async () => {
    mocks.readContract.isPostFrozen.mockResolvedValue(true);
    const get = grabCtx();

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0] as any);
    });

    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith("This post is frozen and can no longer be edited."));
    expect(get().editingTokenId).toBe(null);
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

  it("saveEditedPost requires wallet connection", async () => {
    mocks.walletAddress = null;
    const get = grabCtx();

    await act(async () => {
      await get().saveEditedPost();
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
  });

  it("saveEditedPost returns early when editingTokenId is missing", async () => {
    const get = grabCtx();
    mocks.runContractTx.mockClear();

    await act(async () => {
      await get().saveEditedPost();
    });

    expect(mocks.runContractTx).not.toHaveBeenCalled();
  });

  it("saveEditedPost validates required fields", async () => {
    const get = grabCtx();

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0] as any);
    });
    await waitFor(() => expect(get().editingTokenId).toBe("1"));

    await act(async () => {
      get().setEditDraft((prev) => ({ ...prev, body: "   ", imageUrl: "" }));
    });
    await act(async () => {
      await get().saveEditedPost();
    });
    expect(mocks.setStatus).toHaveBeenCalledWith("Post text is required.");
  });

  it("saveEditedPost allows edits without an image", async () => {
    const get = grabCtx();

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0] as any);
    });
    await waitFor(() => expect(get().editingTokenId).toBe("1"));

    await act(async () => {
      get().setEditDraft((prev) => ({ ...prev, body: "Updated", imageUrl: "", imageDataUrl: "" }));
    });

    await act(async () => {
      await get().saveEditedPost();
    });

    expect(mocks.writeContract.updatePostURI).toHaveBeenCalledWith(1n, expect.any(String));
  });

  it("saveEditedPost rejects oversized non-IPFS tokenUri", async () => {
    const get = grabCtx();

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0] as any);
    });
    await waitFor(() => expect(get().editingTokenId).toBe("1"));

    mocks.metadataUri = "x".repeat(140_001);
    await act(async () => {
      get().setEditDraft((prev) => ({ ...prev, body: "Updated", imageUrl: "data:image/png;base64,AAA" }));
    });
    await act(async () => {
      await get().saveEditedPost();
    });

    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Updated metadata is too large. Configure IPFS (Pinata) or use a smaller image."
    );
    expect(mocks.writeContract.updatePostURI).not.toHaveBeenCalled();
  });

  it("saveEditedPost uses IPFS tokenUri when configured", async () => {
    mocks.hasPinata = true;
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

    expect(mocks.setStatus).toHaveBeenCalledWith("Uploading update to IPFS (Pinata)...");
    expect(buildIpfsTokenUri).toHaveBeenCalled();
    expect(mocks.writeContract.updatePostURI).toHaveBeenCalledWith(1n, mocks.ipfsTokenUri);
  });

  it("saveEditedPost marks the initializing toast as failed when IPFS build fails", async () => {
    mocks.hasPinata = true;
    (buildIpfsTokenUri as any).mockRejectedValueOnce(new Error("boom"));

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

    expect(mocks.txNotifications.notifyFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: expect.stringMatching(/^local-/),
        label: "Updating post",
        error: "boom"
      })
    );
    expect(mocks.setStatus).toHaveBeenCalledWith("boom");
  });

  it("burnPost calls burnPost and removes local post", async () => {
    const get = grabCtx();

    await act(async () => {
      get().onTipDraftChange("1", "0.01");
      get().onCommentDraftChange("1", "hi");
    });
    mocks.feedState.postComments = { "1": [{ comment: "x" }] } as any;

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0] as any);
    });
    await waitFor(() => expect(get().editingTokenId).toBe("1"));

    await act(async () => {
      await get().burnPost("1");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Burn post", expect.any(Function));
    expect(mocks.writeContract.burnPost).toHaveBeenCalledWith(1n);
    expect(mocks.feedState.posts.find((p) => p.tokenId === "1")).toBeUndefined();
    expect(get().editingTokenId).toBe(null);
    expect(get().tipDrafts["1"]).toBeUndefined();
    expect(get().commentDrafts["1"]).toBeUndefined();
    expect(mocks.feedState.postComments["1"]).toBeUndefined();
    expect(mocks.refreshFeed).toHaveBeenCalled();
  });

  it("burnPost returns early on wrong network", async () => {
    mocks.chainId = "1";
    const get = grabCtx();

    await act(async () => {
      await get().burnPost("1", "2");
    });

    expect(mocks.writeContract.burnPost).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Wrong network. Switch to #2 to interact with this post."
    );
  });

  it("burnPost only removes matching chain when postChainId is provided", async () => {
    mocks.chainId = "1";
    const get = grabCtx();

    mocks.feedState.posts = [
      {
        ...mocks.feedState.posts[0],
        chainId: "1"
      },
      {
        tokenId: "2",
        chainId: "1",
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
      },
      {
        ...mocks.feedState.posts[0],
        chainId: "8453"
      }
    ] as any[];

    await act(async () => {
      await get().burnPost("1", "1");
    });

    expect(mocks.feedState.posts.some((p: any) => p.tokenId === "1" && p.chainId === "1")).toBe(false);
    expect(mocks.feedState.posts.some((p: any) => p.tokenId === "1" && p.chainId === "8453")).toBe(true);
    expect(mocks.feedState.posts.some((p: any) => p.tokenId === "2")).toBe(true);
  });

  it("handleTip returns early on wrong network", async () => {
    mocks.chainId = "1";
    const get = grabCtx();

    await act(async () => {
      get().onTipDraftChange("1", "0.01");
    });
    await act(async () => {
      await get().handleTip("1", "2");
    });

    expect(mocks.writeContract.tipPost).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Wrong network. Switch to #2 to interact with this post."
    );
  });

  it("handleAction returns early on wrong network", async () => {
    mocks.chainId = "1";
    const get = grabCtx();

    await act(async () => {
      await get().handleAction("1", "like", "2");
    });

    expect(mocks.writeContract.likePost).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Wrong network. Switch to #2 to interact with this post."
    );
  });

  it("handleAction comment only updates posts on matching postChainId", async () => {
    mocks.chainId = "1";
    const get = grabCtx();

    mocks.feedState.posts = [
      { ...mocks.feedState.posts[0], chainId: "1", comments: 0 },
      { ...mocks.feedState.posts[0], chainId: "8453", comments: 0 }
    ] as any[];

    await act(async () => {
      get().onCommentDraftChange("1", "Nice");
    });
    await act(async () => {
      await get().handleAction("1", "comment", "1");
    });

    const onEth = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "1");
    const onBase = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "8453");
    expect(onEth.comments).toBe(1);
    expect(onBase.comments).toBe(0);
  });

  it("handleAction share only updates posts on matching postChainId", async () => {
    mocks.chainId = "1";
    const get = grabCtx();
    mocks.writeContract.hasShared.mockResolvedValue(false);

    mocks.feedState.posts = [
      { ...mocks.feedState.posts[0], chainId: "1", shares: 0, repostedByMe: false },
      { ...mocks.feedState.posts[0], chainId: "8453", shares: 0, repostedByMe: false }
    ] as any[];

    await act(async () => {
      await get().handleAction("1", "share", "1");
    });

    const onEth = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "1");
    const onBase = mocks.feedState.posts.find((p: any) => p.tokenId === "1" && p.chainId === "8453");
    expect(onEth.shares).toBe(1);
    expect(onEth.repostedByMe).toBe(true);
    expect(onBase.shares).toBe(0);
    expect(onBase.repostedByMe).toBe(false);
  });

  it("saveEditedPost uses adminUpdatePostURI when owner edits someone else's post", async () => {
    mocks.isOwner = true;
    mocks.walletAddress = "0x000000000000000000000000000000000000bEEF";
    mocks.feedState.posts[0].author = "0x000000000000000000000000000000000000dEaD";
    const get = grabCtx();

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0] as any);
    });
    await waitFor(() => expect(get().editingTokenId).toBe("1"));

    await act(async () => {
      get().setEditDraft((prev: any) => ({ ...prev, body: "Updated", imageUrl: "https://example.com/new.png" }));
    });

    await act(async () => {
      await get().saveEditedPost();
    });

    expect(mocks.writeContract.adminUpdatePostURI).toHaveBeenCalledWith(1n, mocks.metadataUri);
    expect(mocks.writeContract.updatePostURI).not.toHaveBeenCalled();
  });
  it("burnPost uses adminBurnPost when owner burns someone else's post", async () => {
    mocks.isOwner = true;
    mocks.walletAddress = "0x000000000000000000000000000000000000bEEF";
    mocks.feedState.posts[0].author = "0x000000000000000000000000000000000000dEaD";
    const get = grabCtx();

    await act(async () => {
      await get().burnPost("1");
    });

    expect(mocks.writeContract.adminBurnPost).toHaveBeenCalledWith(1n);
    expect(mocks.writeContract.burnPost).not.toHaveBeenCalled();
  });
  it("burnPost no-ops deletions when drafts/comments do not exist", async () => {
    const get = grabCtx();
    mocks.feedState.postComments = {};

    await act(async () => {
      await get().burnPost("1");
    });

    expect(mocks.feedState.postComments).toEqual({});
    expect(get().tipDrafts).toEqual({});
    expect(get().commentDrafts).toEqual({});
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

  it("withdrawTips requires wallet connection", async () => {
    mocks.walletAddress = null;
    const get = grabCtx();

    await act(async () => {
      await get().withdrawTips();
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
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

  it("freezePost returns early when tx returns ok=false", async () => {
    const get = grabCtx();
    mocks.runContractTx.mockResolvedValueOnce(false);

    await act(async () => {
      await get().freezePost("1");
    });

    expect(mocks.setStatus).not.toHaveBeenCalledWith("Post frozen. Editing is now disabled for this token.");
  });

  it("onEditSelectFile returns early when file is null", async () => {
    const get = grabCtx();
    mocks.setStatus.mockClear();

    await act(async () => {
      await get().onEditSelectFile(null);
    });

    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("onEditSelectFile validates file type and video requires IPFS", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().onEditSelectFile(new File(["x"], "x.txt", { type: "text/plain" }));
    });
    expect(mocks.setStatus).toHaveBeenCalledWith("Please select an image or video file.");

    await act(async () => {
      await get().onEditSelectFile(new File(["v"], "v.mp4", { type: "video/mp4" }));
    });
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "Video uploads require IPFS pinning (Pinata). Configure VITE_PINATA_JWT to continue."
    );
  });

  it("onEditSelectFile accepts video when IPFS configured and revokes previous object URL", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:one")
      .mockReturnValueOnce("blob:two");
    (URL as any).revokeObjectURL = vi.fn();

    await act(async () => {
      await get().onEditSelectFile(new File(["v"], "v.mp4", { type: "video/mp4" }));
    });
    expect(get().editDraft.imageDataUrl).toBe("blob:one");

    await act(async () => {
      await get().onEditSelectFile(new File(["v"], "v2.mp4", { type: "video/mp4" }));
    });
    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(get().editDraft.imageDataUrl).toBe("blob:two");
    expect(get().editDraft.imageUrl).toBe("");

    await act(async () => {
      get().onEditClearImage();
    });
    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith("blob:two");

    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
  });

  it("onEditSelectFile uses default filename for videos when file.name is empty", async () => {
    mocks.hasPinata = true;
    const get = grabCtx();

    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    (URL as any).createObjectURL = vi.fn().mockReturnValue("blob:video");
    (URL as any).revokeObjectURL = vi.fn();

    await act(async () => {
      get().startEditPost(mocks.feedState.posts[0]);
    });
    await waitFor(() => expect(get().editingTokenId).toBe("1"));

    await act(async () => {
      await get().onEditSelectFile(new File(["x"], "", { type: "video/mp4" }));
    });

    await act(async () => {
      await get().saveEditedPost();
    });

    expect(buildIpfsTokenUri).toHaveBeenCalled();
    const args = (buildIpfsTokenUri as any).mock.calls.at(-1)?.[0];
    expect(args.imageFilename).toBe("post-video");

    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
  });

  it("onEditSelectFile rejects images that cannot be compressed small enough", async () => {
    const get = grabCtx();

    const originalImage = (globalThis as any).Image;
    class LoadsImage {
      width = 1000;
      height = 1000;
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
          // Always too big
          toDataURL: () => "data:image/jpeg;base64," + "A".repeat(200_000)
        } as any;
      }
      return originalCreateElement(tag);
    });

    vi.useFakeTimers();
    await act(async () => {
      const task = get().onEditSelectFile(new File(["a"], "a.png", { type: "image/png" }));
      await vi.runAllTimersAsync();
      await task;
    });
    vi.useRealTimers();

    expect(mocks.setStatus).toHaveBeenCalledWith("Uploaded image is too large. Try a smaller image.");

    (globalThis as any).Image = originalImage;
    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
    createElementSpy.mockRestore();
  });

  it("onEditSelectFile keeps trying smaller images until on-chain tokenUri fits", async () => {
    const get = grabCtx();

    // Non-IPFS path so createMetadataUri size gate runs.
    mocks.hasPinata = false;

    // First few attempts produce an oversized tokenUri, last one fits.
    let metadataCalls = 0;
    (mocks as any).metadataUri = () => {
      metadataCalls++;
      return metadataCalls < 4 ? "x".repeat(140_001) : "data:application/json;base64,OK";
    };

    const originalImage = (globalThis as any).Image;
    class LoadsImage {
      width = 1000;
      height = 1000;
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
          // Small enough data URL so the *tokenUri* size gate is what forces retries.
          toDataURL: () => "data:image/jpeg;base64," + "A".repeat(10_000)
        } as any;
      }
      return originalCreateElement(tag);
    });

    vi.useFakeTimers();
    await act(async () => {
      const task = get().onEditSelectFile(new File(["a"], "a.png", { type: "image/png" }));
      await vi.runAllTimersAsync();
      await task;
    });
    vi.useRealTimers();

    expect(metadataCalls).toBeGreaterThan(1);
    expect(mocks.setStatus).toHaveBeenCalledWith("Uploaded image ready.");

    (globalThis as any).Image = originalImage;
    if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
    else delete (URL as any).createObjectURL;
    if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
    else delete (URL as any).revokeObjectURL;
    createElementSpy.mockRestore();
  });

    it("startEditPost allows edit when freeze-check errors", async () => {
      mocks.readContract.isPostFrozen.mockRejectedValueOnce(new Error("rpc down"));
      const get = grabCtx();

      await act(async () => {
        get().startEditPost(mocks.feedState.posts[0] as any);
      });

      await waitFor(() => expect(get().editingTokenId).toBe("1"));
      expect(get().editDraft.body).toBe("Hello");
    });

    it("freezePost requires wallet connection", async () => {
      mocks.walletAddress = null;
      const get = grabCtx();

      await act(async () => {
        await get().freezePost("1");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
    });

    it("freezePost reports errors", async () => {
      const get = grabCtx();
      mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        await get().freezePost("1");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
    });

    it("withdrawTips reports errors", async () => {
      const get = grabCtx();
      mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        await get().withdrawTips();
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
    });

    it("onEditSelectFile processes an image and uses a default filename when unnamed", async () => {
      mocks.hasPinata = true;
      const get = grabCtx();

      await act(async () => {
        get().startEditPost(mocks.feedState.posts[0] as any);
      });
      await waitFor(() => expect(get().editingTokenId).toBe("1"));

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
        const task = get().onEditSelectFile(new File(["a"], "", { type: "image/png" }));
        await vi.runAllTimersAsync();
        await task;
      });
      vi.useRealTimers();

      await act(async () => {
        await get().saveEditedPost();
      });

      expect(buildIpfsTokenUri).toHaveBeenCalledWith(expect.objectContaining({ imageFilename: "post-image.jpg" }));

      (globalThis as any).Image = originalImage;
      if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
      else delete (URL as any).createObjectURL;
      if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
      else delete (URL as any).revokeObjectURL;
      createElementSpy.mockRestore();
      (globalThis as any).fetch = originalFetch;
    });

    it("onEditSelectFile reports image processing failures", async () => {
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
        const task = get().onEditSelectFile(new File(["a"], "a.png", { type: "image/png" }));
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

    it("saveEditedPost returns early while image is still processing", async () => {
      const get = grabCtx();

      await act(async () => {
        get().startEditPost(mocks.feedState.posts[0] as any);
      });
      await waitFor(() => expect(get().editingTokenId).toBe("1"));

      const originalImage = (globalThis as any).Image;
      class NeverLoadsImage {
        width = 10;
        height = 10;
        decoding: any;
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        set src(_v: string) {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
      (globalThis as any).Image = NeverLoadsImage as any;

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
      let pending: Promise<void> | undefined;
      act(() => {
        pending = get().onEditSelectFile(new File(["a"], "a.png", { type: "image/png" }));
      });

      await act(async () => {
        await get().saveEditedPost();
      });
      expect(mocks.setStatus).toHaveBeenCalledWith("Please wait for the uploaded image to finish processing.");

      await vi.runAllTimersAsync();
      await pending;
      vi.useRealTimers();

      (globalThis as any).Image = originalImage;
      if (originalCreateObjectURL) (URL as any).createObjectURL = originalCreateObjectURL;
      else delete (URL as any).createObjectURL;
      if (originalRevokeObjectURL) (URL as any).revokeObjectURL = originalRevokeObjectURL;
      else delete (URL as any).revokeObjectURL;
      createElementSpy.mockRestore();
    });

    it("saveEditedPost reports errors", async () => {
      const get = grabCtx();
      mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

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

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
    });

    it("burnPost requires wallet connection", async () => {
      mocks.walletAddress = null;
      const get = grabCtx();

      await act(async () => {
        await get().burnPost("1");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
    });

    it("burnPost reports errors", async () => {
      const get = grabCtx();
      mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        await get().burnPost("1");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
    });

    it("handleTip reports errors", async () => {
      const get = grabCtx();
      mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        get().onTipDraftChange("1", "0.01");
      });
      await act(async () => {
        await get().handleTip("1");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
    });

    it("handleAction requires wallet connection", async () => {
      mocks.walletAddress = null;
      const get = grabCtx();

      await act(async () => {
        await get().handleAction("1", "like");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
    });

    it("handleAction reports errors", async () => {
      const get = grabCtx();
      mocks.writeContract.hasLiked.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        await get().handleAction("1", "like");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
    });
});

  describe("useSocialActions", () => {
    it("throws when used outside the provider", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      function Grabber() {
        useSocialActions();
        return null;
      }

      expect(() => render(<Grabber />)).toThrow(/useSocialActions must be used within <SocialActionsProvider>/);
      consoleError.mockRestore();
    });
  });
