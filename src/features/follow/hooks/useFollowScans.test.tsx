import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@shared/lib/env", () => ({ getEnv: () => ({}) }));
vi.mock("@shared/lib/subgraph", () => ({
  getSubgraphUrlForChainId: () => "https://subgraph.test/x"
}));
vi.mock("@features/contract/contracts/socialPosts", () => ({ socialInterface: {} }));
vi.mock("../services/followEventScanner", () => ({
  scanActiveFollowAddresses: vi.fn(async () => [])
}));

const tryQuerySubgraph = vi.fn();
vi.mock("@shared/lib/subgraphQuery", () => ({
  tryQuerySubgraph: (...args: unknown[]) => tryQuerySubgraph(...args)
}));

import { useFollowScans } from "./useFollowScans";

const ADDRESS = "0x91484b0e55c3d577602763784e34b5c08abfdfcc";
const KEY = ADDRESS.toLowerCase();

function renderScans(chainId: string) {
  return renderHook(
    ({ chainId }: { chainId: string }) =>
      useFollowScans({
        // No provider, so the RPC fallback stops rather than scanning logs -
        // this test is about the subgraph path's loading flag.
        provider: null,
        chainId,
        ensureContractDeployedOnCurrentNetwork: async () => {},
        getReadContract: (async () => ({})) as never,
        setStatus: () => {}
      }),
    { initialProps: { chainId } }
  );
}

describe("useFollowScans", () => {
  beforeEach(() => {
    tryQuerySubgraph.mockReset();
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

    const { result, rerender } = renderScans("97");

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
