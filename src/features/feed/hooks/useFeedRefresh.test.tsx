import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@shared/lib/env", () => ({ getEnv: () => ({}) }));
vi.mock("@shared/lib/socialEvents", () => ({
  isSocialEventsAvailable: () => false,
  subscribeSocialEvents: () => () => {}
}));
vi.mock("./refresh/useHasAnyReadOnlyRpc", () => ({ useHasAnyReadOnlyRpc: () => true }));

const refreshFeedFromNetworks = vi.fn();
vi.mock("../services/feedRefresh", () => ({
  refreshFeedFromNetworks: (args: unknown) => refreshFeedFromNetworks(args)
}));

import { useFeedRefresh } from "./useFeedRefresh";

const POST = { tokenId: "1", chainId: 97 } as never;

function renderFeed(walletAddress: string) {
  return renderHook(
    ({ walletAddress }: { walletAddress: string }) =>
      useFeedRefresh({
        wallet: { provider: {} as never, walletAddress, chainId: "97", walletEpoch: 0 },
        contract: {
          ensureContractDeployedOnCurrentNetwork: async () => {},
          getReadContract: (async () => ({})) as never
        },
        setStatus: () => {},
        selectedNetworkChainIds: ["97"]
      }),
    { initialProps: { walletAddress } }
  );
}

describe("useFeedRefresh", () => {
  beforeEach(() => {
    refreshFeedFromNetworks.mockReset();
  });

  it("does not leave the feed spinner up when the wallet changes mid-refresh", async () => {
    // A wallet switch bumps the epoch but, unlike a chain switch, does not clear
    // the posts. The in-flight refresh had already turned the spinner on, and its
    // finally then declines to turn it off because the epoch is stale. The next
    // refresh sees posts on screen, so it never touches the flag either.
    let release: () => void = () => {};
    const hang = new Promise<void>((resolve) => {
      release = resolve;
    });

    let call = 0;
    refreshFeedFromNetworks.mockImplementation(async (args: { setPosts: (p: unknown) => void }) => {
      call += 1;
      if (call === 1) {
        args.setPosts([POST]);
        await hang;
      }
    });

    const { result, rerender } = renderFeed("0xaaa");

    await waitFor(() => expect(result.current.isFeedLoading).toBe(true));

    // The wallet switch: epoch bumps, posts stay on screen.
    rerender({ walletAddress: "0xbbb" });

    await act(async () => {
      release();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isFeedLoading).toBe(false);
    });
  });
});
