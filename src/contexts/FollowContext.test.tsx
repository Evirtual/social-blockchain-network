import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    walletAddress: "0x000000000000000000000000000000000000bEEF" as string | null,
    provider: {
      getBlockNumber: vi.fn().mockResolvedValue(10)
    } as any,
    setStatus: vi.fn(),
    ensureContractDeployedOnCurrentNetwork: vi.fn().mockResolvedValue(undefined),
    readContract: {
      isFollowing: vi.fn().mockResolvedValue(false),
      filters: {
        Followed: vi.fn().mockReturnValue("followedFilter"),
        Unfollowed: vi.fn().mockReturnValue("unfollowedFilter")
      },
      queryFilter: vi.fn().mockResolvedValue([])
    } as any,
    runContractTx: vi.fn().mockImplementation(async (_label: string, send: () => Promise<any>) => {
      await send();
      return true;
    }),
    writeContract: {
      isFollowing: vi.fn().mockResolvedValue(false),
      follow: vi.fn().mockResolvedValue({}),
      unfollow: vi.fn().mockResolvedValue({})
    } as any,
    parseLog: vi.fn() as any
  };
});

vi.mock("../contracts/socialPosts", () => ({
  socialInterface: {
    parseLog: (args: any) => mocks.parseLog(args)
  }
}));

vi.mock("./WalletContext", () => ({
  useWallet: () => ({ provider: mocks.provider, walletAddress: mocks.walletAddress })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    ensureContractDeployedOnCurrentNetwork: async () => mocks.ensureContractDeployedOnCurrentNetwork(),
    getReadContract: async () => mocks.readContract,
    getWriteContract: async () => mocks.writeContract
  })
}));

vi.mock("./useContractTx", () => ({
  useContractTx: () => ({ runContractTx: mocks.runContractTx })
}));

import { FollowProvider, useFollow } from "./FollowContext";

function grabCtx() {
  let ctx: any;
  function Grabber() {
    ctx = useFollow();
    return null;
  }

  render(
    <FollowProvider>
      <Grabber />
    </FollowProvider>
  );

  return () => ctx as ReturnType<typeof useFollow>;
}

beforeEach(() => {
  mocks.walletAddress = "0x000000000000000000000000000000000000bEEF";
  mocks.provider = {
    getBlockNumber: vi.fn().mockResolvedValue(10)
  } as any;
  mocks.setStatus.mockClear();
  mocks.runContractTx.mockClear();
  mocks.ensureContractDeployedOnCurrentNetwork.mockClear();
  mocks.readContract.isFollowing.mockClear();
  mocks.readContract.filters.Followed.mockClear();
  mocks.readContract.filters.Unfollowed.mockClear();
  mocks.readContract.queryFilter.mockClear();
  mocks.readContract.isFollowing.mockResolvedValue(false);
  mocks.readContract.queryFilter.mockResolvedValue([]);
  mocks.writeContract.isFollowing.mockClear();
  mocks.writeContract.follow.mockClear();
  mocks.writeContract.unfollow.mockClear();
  mocks.writeContract.isFollowing.mockResolvedValue(false);
  mocks.parseLog.mockReset();
});

describe("FollowContext transactions", () => {
  it("loadIsFollowing returns early when followee is empty", async () => {
    const get = grabCtx();
    mocks.ensureContractDeployedOnCurrentNetwork.mockClear();

    await act(async () => {
      await get().loadIsFollowing("");
    });

    expect(mocks.ensureContractDeployedOnCurrentNetwork).not.toHaveBeenCalled();
  });

  it("loadIsFollowing returns early when provider is missing", async () => {
    mocks.provider = null as any;
    const get = grabCtx();
    mocks.ensureContractDeployedOnCurrentNetwork.mockClear();

    await act(async () => {
      await get().loadIsFollowing("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.ensureContractDeployedOnCurrentNetwork).not.toHaveBeenCalled();
  });

  it("loadIsFollowing returns early when wallet is missing", async () => {
    mocks.walletAddress = null;
    const get = grabCtx();
    mocks.ensureContractDeployedOnCurrentNetwork.mockClear();

    await act(async () => {
      await get().loadIsFollowing("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.ensureContractDeployedOnCurrentNetwork).not.toHaveBeenCalled();
  });

    it("loadIsFollowing updates cache on success", async () => {
      const get = grabCtx();
      const followee = "0x000000000000000000000000000000000000dEaD";
      mocks.readContract.isFollowing.mockResolvedValueOnce(true);

      await act(async () => {
        await get().loadIsFollowing(followee);
      });

      const key = followee.toLowerCase();
      expect(get().isFollowingByAddress[key]).toBe(true);
    });

    it("loadIsFollowing ignores chain errors", async () => {
      const get = grabCtx();
      const followee = "0x000000000000000000000000000000000000dEaD";
      mocks.readContract.isFollowing.mockRejectedValueOnce(new Error("rpc down"));

      await act(async () => {
        await get().loadIsFollowing(followee);
      });

      const key = followee.toLowerCase();
      expect(get().isFollowingByAddress[key]).toBeUndefined();
      expect(mocks.setStatus).not.toHaveBeenCalled();
    });

  it("toggleFollow asks to connect wallet when disconnected", async () => {
    mocks.walletAddress = null;
    const get = grabCtx();

    await act(async () => {
      await get().toggleFollow("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("Connect your wallet first.");
  });

  it("toggleFollow returns early when followee is empty", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().toggleFollow("");
    });

    expect(mocks.writeContract.follow).not.toHaveBeenCalled();
    expect(mocks.writeContract.unfollow).not.toHaveBeenCalled();
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("blocks following yourself", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().toggleFollow(mocks.walletAddress!);
    });

    expect(mocks.setStatus).toHaveBeenCalledWith("You cannot follow yourself.");
    expect(mocks.writeContract.follow).not.toHaveBeenCalled();
  });

  it("toggleFollow follows when not following", async () => {
    const get = grabCtx();

    await act(async () => {
      await get().toggleFollow("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.runContractTx).toHaveBeenCalledWith("Follow", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.follow).toHaveBeenCalledWith("0x000000000000000000000000000000000000dEaD");

    const key = "0x000000000000000000000000000000000000dead";
    expect(get().isFollowingByAddress[key]).toBe(true);
  });

  it("toggleFollow unfollows when already following", async () => {
    const get = grabCtx();

    // Prime cache.
    await act(async () => {
      await get().toggleFollow("0x000000000000000000000000000000000000dEaD");
    });

    await act(async () => {
      await get().toggleFollow("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.runContractTx).toHaveBeenLastCalledWith("Unfollow", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.unfollow).toHaveBeenCalledWith("0x000000000000000000000000000000000000dEaD");

    const key = "0x000000000000000000000000000000000000dead";
    expect(get().isFollowingByAddress[key]).toBe(false);
  });

  it("toggleFollow consults chain when cache is unknown", async () => {
    const get = grabCtx();
    mocks.writeContract.isFollowing.mockResolvedValue(true);

    await act(async () => {
      await get().toggleFollow("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.writeContract.isFollowing).toHaveBeenCalled();
    expect(mocks.runContractTx).toHaveBeenCalledWith("Unfollow", expect.any(Function), expect.any(Function));
    expect(mocks.writeContract.unfollow).toHaveBeenCalledWith("0x000000000000000000000000000000000000dEaD");
  });

  it("toggleFollow does not update cache when tx fails", async () => {
    const get = grabCtx();
    mocks.runContractTx.mockResolvedValueOnce(false);

    await act(async () => {
      await get().toggleFollow("0x000000000000000000000000000000000000dEaD");
    });

    const key = "0x000000000000000000000000000000000000dead";
    expect(get().isFollowingByAddress[key]).toBeUndefined();
  });

    it("toggleFollow reports errors", async () => {
      const get = grabCtx();
      mocks.runContractTx.mockRejectedValueOnce(new Error("boom"));

      await act(async () => {
        await get().toggleFollow("0x000000000000000000000000000000000000dEaD");
      });

      expect(mocks.setStatus).toHaveBeenCalledWith("boom");
    });
});

describe("useFollow", () => {
  it("throws when used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      function Bad() {
        useFollow();
        return null;
      }

      expect(() => render(<Bad />)).toThrowError("useFollow must be used within <FollowProvider>");
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("FollowContext loaders", () => {
  it("loadFollowerCountForAddress returns early when provider is missing", async () => {
    mocks.provider = null as any;
    const get = grabCtx();
    mocks.setStatus.mockClear();

    await act(async () => {
      await get().loadFollowerCountForAddress("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.readContract.queryFilter).not.toHaveBeenCalled();
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("loadFollowerCountForAddress covers sort fallbacks and ignores logs without a follower", async () => {
    const get = grabCtx();
    const address = "0x000000000000000000000000000000000000dEaD";

    mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
      if (filter === "followedFilter") {
        return [
          { topics: ["0x"], data: "0x", blockNumber: undefined, logIndex: 5 },
          { topics: ["0x"], data: "0x", blockNumber: 2, index: 1, logIndex: 2 }
        ] as any;
      }
      return [{ topics: ["0x"], data: "0x", blockNumber: undefined, index: undefined, logIndex: undefined }] as any;
    });

    mocks.parseLog.mockReturnValue({ name: "Followed", args: [] } as any);

    await act(async () => {
      await get().loadFollowerCountForAddress(address);
    });

    expect(get().followerCountByAddress[address.toLowerCase()]).toBe(0);
  });

  it("loadFollowerCountForAddress covers sort b.index branch", async () => {
    const get = grabCtx();
    const target = "0x000000000000000000000000000000000000dEaD";

    mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
      if (filter === "followedFilter") {
        return [
          { topics: ["t"], data: "F:0", blockNumber: 1, index: 0 },
          { topics: ["t"], data: "F:1", blockNumber: 1, index: 1 }
        ] as any;
      }
      return [] as any;
    });

    mocks.parseLog.mockImplementation(({ data }: any) => {
      if (data === "F:0") return { name: "Followed", args: ["0xAa", target] };
      if (data === "F:1") return { name: "Followed", args: ["0xAa", target] };
      return null;
    });

    await act(async () => {
      await get().loadFollowerCountForAddress(target);
    });

    expect(get().followerCountByAddress[target.toLowerCase()]).toBe(1);
  });

  it("loadFollowerCountForAddress covers sort b.logIndex and 0 branches", async () => {
    const get = grabCtx();
    const t1 = "0x000000000000000000000000000000000000dEaD";
    const t2 = "0x000000000000000000000000000000000000dEaE";

    mocks.readContract.queryFilter
      // t1 followed/unfollowed
      .mockResolvedValueOnce(
        [
          { topics: ["t"], data: "L:logIndex", blockNumber: 1, index: undefined, logIndex: 5 },
          { topics: ["t"], data: "L:idx", blockNumber: 1, index: 1, logIndex: undefined }
        ] as any
      )
      .mockResolvedValueOnce([] as any)
      // t2 followed/unfollowed
      .mockResolvedValueOnce(
        [
          { topics: ["t"], data: "Z:none", blockNumber: 1, index: undefined, logIndex: undefined },
          { topics: ["t"], data: "Z:idx", blockNumber: 1, index: 1, logIndex: undefined }
        ] as any
      )
      .mockResolvedValueOnce([] as any);

    mocks.parseLog.mockImplementation(() => ({ name: "Followed", args: ["0xAa"] } as any));

    await act(async () => {
      await get().loadFollowerCountForAddress(t1);
      await get().loadFollowerCountForAddress(t2);
    });

    expect(get().followerCountByAddress[t1.toLowerCase()]).toBe(1);
    expect(get().followerCountByAddress[t2.toLowerCase()]).toBe(1);
  });

  it("loadFollowingForAddress ignores logs without a followee", async () => {
    const get = grabCtx();
    const address = "0x000000000000000000000000000000000000dEaD";

    mocks.readContract.queryFilter.mockResolvedValueOnce([
      { topics: ["0x"], data: "0x", blockNumber: undefined, logIndex: 1 }
    ] as any);
    mocks.readContract.queryFilter.mockResolvedValueOnce([] as any);

    mocks.parseLog.mockReturnValue({ name: "Followed", args: [] } as any);

    await act(async () => {
      await get().loadFollowingForAddress(address);
    });

    expect(get().followingByAddress[address.toLowerCase()] ?? []).toEqual([]);
  });

  it("loadFollowerCountForAddress returns early when address is empty", async () => {
    const get = grabCtx();
    mocks.readContract.queryFilter.mockClear();

    await act(async () => {
      await get().loadFollowerCountForAddress("");
    });

    expect(mocks.readContract.queryFilter).not.toHaveBeenCalled();
  });

  it("loadFollowerCountForAddress counts unique active followers", async () => {
    const get = grabCtx();
    const target = "0x000000000000000000000000000000000000dEaD";

    mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
      if (filter === "followedFilter") {
        return [
          { topics: ["t"], data: "F:a", blockNumber: 1, index: 0 },
          { topics: ["t"], data: "F:b", blockNumber: 2, index: 0 },
          { topics: ["t"], data: "bad", blockNumber: 4, index: 0 }
        ];
      }
      return [{ topics: ["t"], data: "U:a", blockNumber: 3, index: 0 }];
    });

    mocks.parseLog.mockImplementation(({ data }: any) => {
      if (data === "bad") throw new Error("bad");
      if (data === "F:a") return { name: "Followed", args: ["0xAa", target] };
      if (data === "F:b") return { name: "Followed", args: ["0xBb", target] };
      if (data === "U:a") return { name: "Unfollowed", args: ["0xAa", target] };
      return null;
    });

    await act(async () => {
      await get().loadFollowerCountForAddress(target);
    });

    const key = target.toLowerCase();
    expect(get().followerCountByAddress[key]).toBe(1);
  });

    it("loadFollowerCountForAddress can page backwards when latest block is high", async () => {
      const get = grabCtx();
      const target = "0x000000000000000000000000000000000000dEaD";
      mocks.provider.getBlockNumber = vi.fn().mockResolvedValue(100_000);
      mocks.readContract.queryFilter.mockResolvedValue([]);

      await act(async () => {
        await get().loadFollowerCountForAddress(target);
      });

      const key = target.toLowerCase();
      expect(get().followerCountByAddress[key]).toBe(0);
    });

  it("loadFollowersForAddress returns active followers ordered by lastBlock", async () => {
    const get = grabCtx();
    const target = "0x000000000000000000000000000000000000dEaD";

    mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
      if (filter === "followedFilter") {
        return [
          { topics: ["t"], data: "F:a", blockNumber: 1, index: 0 },
          { topics: ["t"], data: "F:c", blockNumber: 5, index: 0 }
        ];
      }
      return [{ topics: ["t"], data: "U:a", blockNumber: 3, index: 0 }];
    });

    mocks.parseLog.mockImplementation(({ data }: any) => {
      if (data === "F:a") return { name: "Followed", args: ["0xAa", target] };
      if (data === "F:c") return { name: "Followed", args: ["0xCc", target] };
      if (data === "U:a") return { name: "Unfollowed", args: ["0xAa", target] };
      return null;
    });

    await act(async () => {
      await get().loadFollowersForAddress(target);
    });

    const key = target.toLowerCase();
    expect(get().followersByAddress[key]).toEqual(["0xcc"]);
  });

  it("loadFollowersForAddress returns early when provider is missing", async () => {
    mocks.provider = null as any;
    const get = grabCtx();

    await act(async () => {
      await get().loadFollowersForAddress("0x000000000000000000000000000000000000dEaD");
    });

    expect(mocks.readContract.queryFilter).not.toHaveBeenCalled();
  });

  it("loadFollowersForAddress returns early when address is empty", async () => {
    const get = grabCtx();
    mocks.readContract.queryFilter.mockClear();

    await act(async () => {
      await get().loadFollowersForAddress("");
    });

    expect(mocks.readContract.queryFilter).not.toHaveBeenCalled();
  });

    it("loadFollowersForAddress can page backwards when latest block is high", async () => {
      const get = grabCtx();
      const target = "0x000000000000000000000000000000000000dEaD";
      mocks.provider.getBlockNumber = vi.fn().mockResolvedValue(100_000);
      mocks.readContract.queryFilter.mockResolvedValue([]);

      await act(async () => {
        await get().loadFollowersForAddress(target);
      });

      const key = target.toLowerCase();
      expect(get().followersByAddress[key]).toEqual([]);
    });

    it("loadFollowersForAddress covers sort + args/block fallbacks", async () => {
      const get = grabCtx();
      const target = "0x000000000000000000000000000000000000dEaD";

      mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
        if (filter === "followedFilter") {
          return [
            { topics: ["t"], data: "no-follower", blockNumber: undefined, index: undefined, logIndex: 7 },
            { topics: ["t"], data: "has-follower", blockNumber: undefined, index: undefined, logIndex: undefined }
          ] as any;
        }
        return [] as any;
      });

      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "no-follower") return { name: "Followed", args: [] } as any;
        if (data === "has-follower") return { name: "Followed", args: ["0xAa", target] } as any;
        return null;
      });

      await act(async () => {
        await get().loadFollowersForAddress(target);
      });

      const key = target.toLowerCase();
      expect(get().followersByAddress[key]).toEqual(["0xaa"]);
    });

    it("loadFollowersForAddress covers sort b.index branch", async () => {
      const get = grabCtx();
      const target = "0x000000000000000000000000000000000000dEaD";

      mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
        if (filter === "followedFilter") {
          return [
            { topics: ["t"], data: "F:0", blockNumber: 1, index: 0 },
            { topics: ["t"], data: "F:1", blockNumber: 1, index: 1 }
          ] as any;
        }
        return [] as any;
      });

      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "F:0") return { name: "Followed", args: ["0xAa", target] } as any;
        if (data === "F:1") return { name: "Followed", args: ["0xAa", target] } as any;
        return null;
      });

      await act(async () => {
        await get().loadFollowersForAddress(target);
      });

      expect(get().followersByAddress[target.toLowerCase()]).toEqual(["0xaa"]);
    });

    it("loadFollowersForAddress covers sort b.logIndex and 0 branches", async () => {
      const get = grabCtx();
      const t1 = "0x000000000000000000000000000000000000dEaD";
      const t2 = "0x000000000000000000000000000000000000dEaE";

      mocks.readContract.queryFilter
        // t1 followed/unfollowed
        .mockResolvedValueOnce(
          [
            { topics: ["t"], data: "L:logIndex", blockNumber: 1, index: undefined, logIndex: 5 },
            { topics: ["t"], data: "L:idx", blockNumber: 1, index: 1, logIndex: undefined }
          ] as any
        )
        .mockResolvedValueOnce([] as any)
        // t2 followed/unfollowed
        .mockResolvedValueOnce(
          [
            { topics: ["t"], data: "Z:none", blockNumber: 1, index: undefined, logIndex: undefined },
            { topics: ["t"], data: "Z:idx", blockNumber: 1, index: 1, logIndex: undefined }
          ] as any
        )
        .mockResolvedValueOnce([] as any);

      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "L:logIndex" || data === "L:idx") return { name: "Followed", args: ["0xAa", t1] } as any;
        if (data === "Z:none" || data === "Z:idx") return { name: "Followed", args: ["0xBb", t2] } as any;
        return null;
      });

      await act(async () => {
        await get().loadFollowersForAddress(t1);
        await get().loadFollowersForAddress(t2);
      });

      expect(get().followersByAddress[t1.toLowerCase()]).toEqual(["0xaa"]);
      expect(get().followersByAddress[t2.toLowerCase()]).toEqual(["0xbb"]);
    });

    it("loadFollowersForAddress ignores parseLog failures", async () => {
      const get = grabCtx();
      const target = "0x000000000000000000000000000000000000dEaD";

      mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
        if (filter === "followedFilter") {
          return [{ topics: ["t"], data: "bad", blockNumber: 1, index: 0 }];
        }
        return [];
      });
      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "bad") throw new Error("bad");
        return null;
      });

      await act(async () => {
        await get().loadFollowersForAddress(target);
      });

      const key = target.toLowerCase();
      expect(get().followersByAddress[key]).toEqual([]);
    });

  it("loadFollowingForAddress returns active followees ordered by lastBlock", async () => {
    const get = grabCtx();
    const me = mocks.walletAddress!;

    mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
      if (filter === "followedFilter") {
        return [
          { topics: ["t"], data: "F:x", blockNumber: 1, index: 0 },
          { topics: ["t"], data: "F:y", blockNumber: 2, index: 0 }
        ];
      }
      return [{ topics: ["t"], data: "U:x", blockNumber: 3, index: 0 }];
    });

    mocks.parseLog.mockImplementation(({ data }: any) => {
      if (data === "F:x") return { name: "Followed", args: [me, "0xXx"] };
      if (data === "F:y") return { name: "Followed", args: [me, "0xYy"] };
      if (data === "U:x") return { name: "Unfollowed", args: [me, "0xXx"] };
      return null;
    });

    await act(async () => {
      await get().loadFollowingForAddress(me);
    });

    const key = me.toLowerCase();
    expect(get().followingByAddress[key]).toEqual(["0xyy"]);
  });

  it("loadFollowingForAddress returns early when provider is missing", async () => {
    mocks.provider = null as any;
    const get = grabCtx();
    mocks.readContract.queryFilter.mockClear();

    await act(async () => {
      await get().loadFollowingForAddress("0x000000000000000000000000000000000000bEEF");
    });

    expect(mocks.readContract.queryFilter).not.toHaveBeenCalled();
  });

  it("loadFollowingForAddress returns early when address is empty", async () => {
    const get = grabCtx();
    mocks.readContract.queryFilter.mockClear();

    await act(async () => {
      await get().loadFollowingForAddress("");
    });

    expect(mocks.readContract.queryFilter).not.toHaveBeenCalled();
  });

    it("loadFollowingForAddress can page backwards when latest block is high", async () => {
      const get = grabCtx();
      const me = mocks.walletAddress!;
      mocks.provider.getBlockNumber = vi.fn().mockResolvedValue(100_000);
      mocks.readContract.queryFilter.mockResolvedValue([]);

      await act(async () => {
        await get().loadFollowingForAddress(me);
      });

      const key = me.toLowerCase();
      expect(get().followingByAddress[key]).toEqual([]);
    });

    it("loadFollowingForAddress covers sort + args/block fallbacks", async () => {
      const get = grabCtx();
      const me = mocks.walletAddress!;

      mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
        if (filter === "followedFilter") {
          return [
            { topics: ["t"], data: "no-followee", blockNumber: undefined, index: undefined, logIndex: 5 },
            { topics: ["t"], data: "has-followee", blockNumber: undefined, index: undefined, logIndex: undefined }
          ] as any;
        }
        return [] as any;
      });

      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "no-followee") return { name: "Followed", args: [] } as any;
        if (data === "has-followee") return { name: "Followed", args: [me, "0xBb"] } as any;
        return null;
      });

      await act(async () => {
        await get().loadFollowingForAddress(me);
      });

      const key = me.toLowerCase();
      expect(get().followingByAddress[key]).toEqual(["0xbb"]);
    });

    it("loadFollowingForAddress covers sort b.index branch", async () => {
      const get = grabCtx();
      const me = mocks.walletAddress!;

      mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
        if (filter === "followedFilter") {
          return [
            { topics: ["t"], data: "F:0", blockNumber: 1, index: 0 },
            { topics: ["t"], data: "F:1", blockNumber: 1, index: 1 }
          ] as any;
        }
        return [] as any;
      });

      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "F:0") return { name: "Followed", args: [me, "0xBb"] } as any;
        if (data === "F:1") return { name: "Followed", args: [me, "0xBb"] } as any;
        return null;
      });

      await act(async () => {
        await get().loadFollowingForAddress(me);
      });

      expect(get().followingByAddress[me.toLowerCase()]).toEqual(["0xbb"]);
    });

    it("loadFollowingForAddress covers sort b.logIndex and 0 branches", async () => {
      const get = grabCtx();
      const a1 = "0x000000000000000000000000000000000000bEEF";
      const a2 = "0x000000000000000000000000000000000000bEE0";

      mocks.readContract.queryFilter
        // a1 followed/unfollowed
        .mockResolvedValueOnce(
          [
            { topics: ["t"], data: "L:logIndex", blockNumber: 1, index: undefined, logIndex: 5 },
            { topics: ["t"], data: "L:idx", blockNumber: 1, index: 1, logIndex: undefined }
          ] as any
        )
        .mockResolvedValueOnce([] as any)
        // a2 followed/unfollowed
        .mockResolvedValueOnce(
          [
            { topics: ["t"], data: "Z:none", blockNumber: 1, index: undefined, logIndex: undefined },
            { topics: ["t"], data: "Z:idx", blockNumber: 1, index: 1, logIndex: undefined }
          ] as any
        )
        .mockResolvedValueOnce([] as any);

      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "L:logIndex" || data === "L:idx") return { name: "Followed", args: [a1, "0xAa"] } as any;
        if (data === "Z:none" || data === "Z:idx") return { name: "Followed", args: [a2, "0xBb"] } as any;
        return null;
      });

      await act(async () => {
        await get().loadFollowingForAddress(a1);
        await get().loadFollowingForAddress(a2);
      });

      expect(get().followingByAddress[a1.toLowerCase()]).toEqual(["0xaa"]);
      expect(get().followingByAddress[a2.toLowerCase()]).toEqual(["0xbb"]);
    });

    it("loadFollowingForAddress ignores parseLog failures", async () => {
      const get = grabCtx();
      const me = mocks.walletAddress!;

      mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
        if (filter === "followedFilter") {
          return [{ topics: ["t"], data: "bad", blockNumber: 1, index: 0 }];
        }
        return [];
      });
      mocks.parseLog.mockImplementation(({ data }: any) => {
        if (data === "bad") throw new Error("bad");
        return null;
      });

      await act(async () => {
        await get().loadFollowingForAddress(me);
      });

      const key = me.toLowerCase();
      expect(get().followingByAddress[key]).toEqual([]);
    });

  it("de-dupes in-flight follower count requests", async () => {
    const get = grabCtx();
    const target = "0x000000000000000000000000000000000000dEaD";

    mocks.readContract.queryFilter.mockImplementation(async (filter: any) => {
      if (filter === "followedFilter") {
        return [{ topics: ["t"], data: "F:a", blockNumber: 1, index: 0 }];
      }
      return [];
    });
    mocks.parseLog.mockImplementation(({ data }: any) => {
      if (data === "F:a") return { name: "Followed", args: ["0xAa", target] };
      return null;
    });

    await act(async () => {
      await Promise.all([get().loadFollowerCountForAddress(target), get().loadFollowerCountForAddress(target)]);
    });

    expect(mocks.readContract.queryFilter).toHaveBeenCalledTimes(2);
  });

  it("de-dupes in-flight followers list requests", async () => {
    const get = grabCtx();
    const target = "0x000000000000000000000000000000000000dEaD";

    let resolve: (() => void) | null = null;
    const gate = new Promise<void>((r) => (resolve = r));
    mocks.readContract.queryFilter.mockImplementation(async () => {
      await gate;
      return [];
    });

    await act(async () => {
      const a = get().loadFollowersForAddress(target);
      const b = get().loadFollowersForAddress(target);
      resolve?.();
      await Promise.all([a, b]);
    });

    // queryFilter is invoked for followed/unfollowed once each in the single task.
    expect(mocks.readContract.queryFilter).toHaveBeenCalledTimes(2);
  });

  it("de-dupes in-flight following list requests", async () => {
    const get = grabCtx();
    const me = mocks.walletAddress!;

    let resolve: (() => void) | null = null;
    const gate = new Promise<void>((r) => (resolve = r));
    mocks.readContract.queryFilter.mockImplementation(async () => {
      await gate;
      return [];
    });

    await act(async () => {
      const a = get().loadFollowingForAddress(me);
      const b = get().loadFollowingForAddress(me);
      resolve?.();
      await Promise.all([a, b]);
    });

    expect(mocks.readContract.queryFilter).toHaveBeenCalledTimes(2);
  });

  it("sets status when RPC cannot serve follower log range", async () => {
    const get = grabCtx();
    const target = "0x000000000000000000000000000000000000dEaD";

    mocks.provider.getBlockNumber = vi.fn().mockResolvedValue(1);
    mocks.readContract.queryFilter.mockImplementation(async () => {
      throw new Error("rpc down");
    });

    await act(async () => {
      await get().loadFollowerCountForAddress(target);
    });

    expect(mocks.setStatus).toHaveBeenCalledWith(expect.stringMatching(/RPC could not serve follower log range/));
  });

    it("sets status when RPC cannot serve followers log range", async () => {
      const get = grabCtx();
      const target = "0x000000000000000000000000000000000000dEaD";

      mocks.provider.getBlockNumber = vi.fn().mockResolvedValue(1);
      mocks.readContract.queryFilter.mockImplementation(async () => {
        throw new Error("rpc down");
      });

      await act(async () => {
        await get().loadFollowersForAddress(target);
      });

      expect(mocks.setStatus).toHaveBeenCalledWith(expect.stringMatching(/RPC could not serve follower log range/));
    });

    it("sets status when RPC cannot serve following log range", async () => {
      const get = grabCtx();
      const me = mocks.walletAddress!;

      mocks.provider.getBlockNumber = vi.fn().mockResolvedValue(1);
      mocks.readContract.queryFilter.mockImplementation(async () => {
        throw new Error("rpc down");
      });

      await act(async () => {
        await get().loadFollowingForAddress(me);
      });

      expect(mocks.setStatus).toHaveBeenCalledWith(expect.stringMatching(/RPC could not serve following log range/));
    });
});
