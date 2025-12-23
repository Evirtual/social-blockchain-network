import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    walletAddress: "0x000000000000000000000000000000000000bEEF" as string | null,
    provider: {},
    setStatus: vi.fn(),
    runContractTx: vi.fn().mockImplementation(async (_label: string, send: () => Promise<any>) => {
      await send();
      return true;
    }),
    writeContract: {
      isFollowing: vi.fn().mockResolvedValue(false),
      follow: vi.fn().mockResolvedValue({}),
      unfollow: vi.fn().mockResolvedValue({})
    } as any
  };
});

vi.mock("./WalletContext", () => ({
  useWallet: () => ({ provider: mocks.provider, walletAddress: mocks.walletAddress })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    ensureContractDeployedOnCurrentNetwork: async () => {},
    getReadContract: async () => ({}),
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
  mocks.setStatus.mockClear();
  mocks.runContractTx.mockClear();
  mocks.writeContract.isFollowing.mockClear();
  mocks.writeContract.follow.mockClear();
  mocks.writeContract.unfollow.mockClear();
  mocks.writeContract.isFollowing.mockResolvedValue(false);
});

describe("FollowContext transactions", () => {
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
});
