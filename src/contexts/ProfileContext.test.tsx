import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    walletAddress: "0x000000000000000000000000000000000000bEEF" as string | null,
    setStatus: vi.fn(),
    runContractTx: vi.fn().mockImplementation(async (_label: string, send: () => Promise<any>) => {
      await send();
      return undefined;
    }),
    writeContract: {
      setProfile: vi.fn().mockResolvedValue({})
    } as any
  };
});

vi.mock("../ipfs", () => ({
  hasPinata: () => false,
  pinataPinFile: vi.fn()
}));

vi.mock("./WalletContext", () => ({
  useWallet: () => ({ provider: {}, walletAddress: mocks.walletAddress })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./FeedContext", () => ({
  useFeed: () => ({ posts: [] })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({
    getReadContract: async () => ({}),
    getWriteContract: async () => mocks.writeContract,
    ensureContractDeployedOnCurrentNetwork: async () => {}
  })
}));

vi.mock("./useContractTx", () => ({
  useContractTx: () => ({ runContractTx: mocks.runContractTx })
}));

import { ProfileProvider, useProfile } from "./ProfileContext";

function grabCtx() {
  let ctx: any;
  function Grabber() {
    ctx = useProfile();
    return null;
  }

  render(
    <ProfileProvider>
      <Grabber />
    </ProfileProvider>
  );

  return () => ctx as ReturnType<typeof useProfile>;
}

beforeEach(() => {
  mocks.walletAddress = "0x000000000000000000000000000000000000bEEF";
  mocks.setStatus.mockClear();
  mocks.runContractTx.mockClear();
  mocks.writeContract.setProfile.mockClear();
});

describe("ProfileContext transactions", () => {
  it("saveProfile calls setProfile and updates local state", async () => {
    const get = grabCtx();

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
});
