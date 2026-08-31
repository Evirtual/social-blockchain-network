import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@shared/lib/env", () => ({ getEnv: () => ({}) }));
vi.mock("@shared/lib/subgraph", () => ({
  getSubgraphUrlForChainId: () => "https://subgraph.test/x"
}));
vi.mock("@features/contract/contracts/socialPosts", () => ({ socialInterface: {} }));

const scanActiveFollowAddresses = vi.fn();
vi.mock("../services/followEventScanner", () => ({
  scanActiveFollowAddresses: (args: unknown) => scanActiveFollowAddresses(args)
}));

const tryQuerySubgraph = vi.fn();
vi.mock("@shared/lib/subgraphQuery", () => ({
  tryQuerySubgraph: (args: unknown) => tryQuerySubgraph(args)
}));

import { useFollowScans } from "./useFollowScans";

const ADDRESS = "0x91484b0e55c3d577602763784e34b5c08abfdfcc";
const KEY = ADDRESS.toLowerCase();
const OTHER = "0x1111111111111111111111111111111111111111";
const THIRD = "0x2222222222222222222222222222222222222222";

const readContract = {
  filters: {
    Followed: (...args: unknown[]) => ({ name: "Followed", args }),
    Unfollowed: (...args: unknown[]) => ({ name: "Unfollowed", args })
  }
};

function renderScans(opts: { chainId?: string; withProvider?: boolean } = {}) {
  const { chainId = "97", withProvider = false } = opts;
  return renderHook(
    ({ chainId }: { chainId: string }) =>
      useFollowScans({
        provider: withProvider ? ({} as never) : null,
        chainId,
        ensureContractDeployedOnCurrentNetwork: async () => {},
        getReadContract: (async () => readContract) as never,
        setStatus: () => {}
      }),
    { initialProps: { chainId } }
  );
}

/** Answers each query by name, so tests do not depend on call ordering. */
function respond(map: Record<string, unknown>) {
  tryQuerySubgraph.mockImplementation(async ({ query }: { query: string }) => {
    for (const [name, value] of Object.entries(map)) {
      if (query.includes(name)) return value;
    }
    return { ok: false, error: new Error("no stub for query") };
  });
}

const BUNDLE_MISS = { ok: false, error: new Error("bundle down") };

describe("useFollowScans", () => {
  beforeEach(() => {
    tryQuerySubgraph.mockReset();
    scanActiveFollowAddresses.mockReset();
  });

  describe("reading from the subgraph", () => {
    it("resolves followers, and the count alongside them", async () => {
      respond({
        FollowBundle: BUNDLE_MISS,
        "query Followers": {
          ok: true,
          data: { followEdges: [{ follower: { id: OTHER } }, { follower: { id: THIRD } }] }
        }
      });

      const { result } = renderScans();
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      expect(result.current.followersByAddress[KEY]).toEqual([OTHER, THIRD]);
      expect(result.current.followerCountByAddress[KEY]).toBe(2);
      expect(result.current.isLoadingFollowersByAddress[KEY]).toBe(false);
    });

    it("resolves following", async () => {
      respond({
        FollowBundle: BUNDLE_MISS,
        "query Following": { ok: true, data: { followEdges: [{ followee: { id: OTHER } }] } }
      });

      const { result } = renderScans();
      await act(async () => {
        await result.current.loadFollowingForAddress(ADDRESS);
      });

      expect(result.current.followingByAddress[KEY]).toEqual([OTHER]);
      expect(result.current.isLoadingFollowingByAddress[KEY]).toBe(false);
    });

    it("resolves the follower count on its own", async () => {
      respond({
        FollowBundle: BUNDLE_MISS,
        FollowerCount: { ok: true, data: { account: { followersCount: "7" } } }
      });

      const { result } = renderScans();
      await act(async () => {
        await result.current.loadFollowerCountForAddress(ADDRESS);
      });

      expect(result.current.followerCountByAddress[KEY]).toBe(7);
    });

    it("takes followers, following and the count from one bundled query when it succeeds", async () => {
      respond({
        FollowBundle: {
          ok: true,
          data: {
            account: { followersCount: "1" },
            followersEdges: [{ follower: { id: OTHER } }],
            followingEdges: [{ followee: { id: THIRD } }]
          }
        }
      });

      const { result } = renderScans();
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      expect(result.current.followersByAddress[KEY]).toEqual([OTHER]);
      expect(result.current.followingByAddress[KEY]).toEqual([THIRD]);
      expect(result.current.followerCountByAddress[KEY]).toBe(1);
      // The bundle covered it, so no follow-up query was needed.
      expect(tryQuerySubgraph).toHaveBeenCalledTimes(1);
    });

    it("normalises addresses to lower case and drops empty entries", async () => {
      respond({
        FollowBundle: BUNDLE_MISS,
        "query Followers": {
          ok: true,
          data: { followEdges: [{ follower: { id: OTHER.toUpperCase() } }, { follower: null }] }
        }
      });

      const { result } = renderScans();
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      expect(result.current.followersByAddress[KEY]).toEqual([OTHER]);
    });
  });

  describe("falling back to an on-chain scan", () => {
    it("scans for followers when the subgraph fails", async () => {
      respond({});
      scanActiveFollowAddresses.mockResolvedValue([OTHER.toUpperCase()]);

      const { result } = renderScans({ withProvider: true });
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      expect(result.current.followersByAddress[KEY]).toEqual([OTHER]);
      // Followers come from the followee side of the event.
      expect(scanActiveFollowAddresses).toHaveBeenCalledWith(
        expect.objectContaining({ addressArgIndex: 0 })
      );
    });

    it("scans for following with the other side of the event", async () => {
      respond({});
      scanActiveFollowAddresses.mockResolvedValue([THIRD]);

      const { result } = renderScans({ withProvider: true });
      await act(async () => {
        await result.current.loadFollowingForAddress(ADDRESS);
      });

      expect(result.current.followingByAddress[KEY]).toEqual([THIRD]);
      expect(scanActiveFollowAddresses).toHaveBeenCalledWith(
        expect.objectContaining({ addressArgIndex: 1 })
      );
    });

    it("counts followers from the scan when the subgraph fails", async () => {
      respond({});
      scanActiveFollowAddresses.mockResolvedValue([OTHER, THIRD]);

      const { result } = renderScans({ withProvider: true });
      await act(async () => {
        await result.current.loadFollowerCountForAddress(ADDRESS);
      });

      expect(result.current.followerCountByAddress[KEY]).toBe(2);
    });

    it("stops without a provider rather than scanning, and clears the skeleton", async () => {
      respond({});

      const { result } = renderScans({ withProvider: false });
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      expect(scanActiveFollowAddresses).not.toHaveBeenCalled();
      expect(result.current.followersByAddress[KEY]).toBeUndefined();
      expect(result.current.isLoadingFollowersByAddress[KEY]).toBeFalsy();
    });
  });

  describe("not repeating work", () => {
    it("does not query again for an address it has already resolved", async () => {
      respond({
        FollowBundle: BUNDLE_MISS,
        "query Followers": { ok: true, data: { followEdges: [{ follower: { id: OTHER } }] } }
      });

      const { result } = renderScans();
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });
      const callsAfterFirst = tryQuerySubgraph.mock.calls.length;

      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      expect(tryQuerySubgraph.mock.calls.length).toBe(callsAfterFirst);
    });

    it("bundles again after a chain switch, rather than skipping it for good", async () => {
      // The bundle is per chain, so switching invalidates it. Leaving the
      // "already bundled" mark in place made every later load fall through to
      // the individual queries - correct data, three round trips instead of one.
      respond({
        FollowBundle: {
          ok: true,
          data: { account: { followersCount: "0" }, followersEdges: [], followingEdges: [] }
        }
      });

      const { result, rerender } = renderScans();
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });
      expect(tryQuerySubgraph).toHaveBeenCalledTimes(1);

      rerender({ chainId: "84532" });
      await act(async () => {
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      const bundleCalls = tryQuerySubgraph.mock.calls.filter(([a]) =>
        String((a as { query: string }).query).includes("FollowBundle")
      );
      expect(bundleCalls).toHaveLength(2);
    });

    it("does nothing without an address or a chain", async () => {
      respond({});
      const { result } = renderScans({ chainId: "" });

      await act(async () => {
        await result.current.loadFollowersForAddress("");
        await result.current.loadFollowersForAddress(ADDRESS);
      });

      expect(tryQuerySubgraph).not.toHaveBeenCalled();
    });
  });

  it("does not leave the followers skeleton up when the chain changes mid-load", async () => {
    // The bundle query hangs long enough for a chain switch to land, which is
    // what happens on a slow connection. The follow-up query then starts with an
    // epoch that is already stale, so its finally declines to clear the flag -
    // the flag must therefore never be set in the first place.
    let releaseBundle: (v: unknown) => void = () => {};
    const bundlePending = new Promise((resolve) => {
      releaseBundle = resolve;
    });

    tryQuerySubgraph
      .mockImplementationOnce(async () => await bundlePending)
      .mockImplementation(async () => ({ ok: false, error: new Error("subgraph down") }));

    const { result, rerender } = renderScans();

    let pending: Promise<void>;
    act(() => {
      pending = result.current.loadFollowersForAddress(ADDRESS);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // The chain switch resets the loading maps and bumps the epoch.
    rerender({ chainId: "84532" });

    await act(async () => {
      releaseBundle({ ok: false, error: new Error("subgraph down") });
      await pending!;
    });

    await waitFor(() => {
      expect(result.current.isLoadingFollowersByAddress[KEY]).toBeFalsy();
    });
  });
});
