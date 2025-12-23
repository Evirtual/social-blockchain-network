import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const txNotifications = {
    notifySigning: vi.fn(() => "signing-id"),
    notifyPending: vi.fn(),
    notifyConfirmed: vi.fn(),
    notifyFailed: vi.fn(),
    notifyCancelled: vi.fn(),
    dismiss: vi.fn()
  };

  return {
    chainId: "8453" as string | null,
    setStatus: vi.fn(),
    ensureContractDeployedOnCurrentNetwork: vi.fn().mockResolvedValue(undefined),
    txNotifications
  };
});

vi.mock("../lib/errors", () => ({
  getErrorMessage: (e: any) => (typeof e?.message === "string" ? e.message : "ERR")
}));

vi.mock("../lib/chain", () => ({
  getExplorerTxUrl: (chainId: string | null, hash: string) => (chainId ? `explorer://${chainId}/${hash}` : null)
}));

vi.mock("./WalletContext", () => ({
  useWallet: () => ({ chainId: mocks.chainId })
}));

vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus: mocks.setStatus })
}));

vi.mock("./ContractContext", () => ({
  useContract: () => ({ ensureContractDeployedOnCurrentNetwork: mocks.ensureContractDeployedOnCurrentNetwork })
}));

vi.mock("./TxNotificationsContext", () => ({
  useTxNotifications: () => mocks.txNotifications,
  isUserRejectedTx: (e: any) => e?.code === 4001 || e?.code === "ACTION_REJECTED"
}));

import { useContractTx } from "./useContractTx";

function setup() {
  let api: ReturnType<typeof useContractTx> | null = null;

  function Grabber() {
    api = useContractTx();
    return null;
  }

  render(<Grabber />);

  return () => {
    if (!api) throw new Error("hook not initialized");
    return api;
  };
}

beforeEach(() => {
  mocks.chainId = "8453";
  mocks.setStatus.mockClear();
  mocks.ensureContractDeployedOnCurrentNetwork.mockClear();
  Object.values(mocks.txNotifications).forEach((fn) => {
    if (typeof fn === "function" && "mockClear" in fn) (fn as any).mockClear();
  });
});

describe("useContractTx.runContractTx lifecycle", () => {
  it("runs full cycle: signing -> pending -> confirmed", async () => {
    const get = setup();

    const wait = vi.fn().mockResolvedValue({ hash: "0xabc", logs: [] });
    const send = vi.fn().mockResolvedValue({ hash: "0xabc", wait });
    const onReceipt = vi.fn().mockResolvedValue("OK");

    let result: any;
    await act(async () => {
      result = await get().runContractTx("Like", send as any, onReceipt);
    });

    expect(result).toBe("OK");
    expect(mocks.ensureContractDeployedOnCurrentNetwork).toHaveBeenCalled();

    expect(mocks.setStatus).toHaveBeenCalledWith("Like (confirm in wallet)...");
    expect(mocks.txNotifications.notifySigning).toHaveBeenCalledWith("Like");

    expect(send).toHaveBeenCalled();
    expect(mocks.txNotifications.dismiss).toHaveBeenCalledWith("signing-id");

    expect(mocks.txNotifications.notifyPending).toHaveBeenCalledWith({
      hash: "0xabc",
      label: "Like",
      explorerUrl: "explorer://8453/0xabc"
    });
    expect(mocks.setStatus).toHaveBeenCalledWith("Like: pending...");

    expect(wait).toHaveBeenCalled();
    expect(mocks.txNotifications.notifyConfirmed).toHaveBeenCalledWith("0xabc");
    expect(mocks.setStatus).toHaveBeenCalledWith("Like: confirmed.");
    expect(onReceipt).toHaveBeenCalledWith({ hash: "0xabc", logs: [] });
  });

  it("dismisses signing toast if send throws", async () => {
    const get = setup();

    const err = new Error("boom");
    const send = vi.fn().mockRejectedValue(err);

    const promise = get().runContractTx("Tip", send as any);
    await expect(promise).rejects.toThrow("boom");
    await act(async () => {
      try {
        await promise;
      } catch {
        // expected
      }
    });

    expect(mocks.txNotifications.dismiss).toHaveBeenCalledWith("signing-id");
    expect(mocks.txNotifications.notifyFailed).toHaveBeenCalledWith({ label: "Tip", error: "boom" });
  });

  it("handles user rejection as cancelled (no generic failed without hash)", async () => {
    const get = setup();

    const err: any = new Error("User rejected");
    err.code = 4001;

    const send = vi.fn().mockRejectedValue(err);

    const promise = get().runContractTx("Follow", send as any);
    await expect(promise).rejects.toThrow("User rejected");
    await act(async () => {
      try {
        await promise;
      } catch {
        // expected
      }
    });

    expect(mocks.txNotifications.notifyCancelled).toHaveBeenCalledWith("Follow");

    // For rejected tx without a hash, we should not add a failed notice.
    expect(mocks.txNotifications.notifyFailed).not.toHaveBeenCalledWith({ label: "Follow", error: "User rejected" });
  });

  it("includes hash when error carries it", async () => {
    const get = setup();

    const err: any = new Error("revert");
    err.hash = "0xdead";

    const send = vi.fn().mockRejectedValue(err);

    const promise = get().runContractTx("Burn post", send as any);
    await expect(promise).rejects.toThrow("revert");
    await act(async () => {
      try {
        await promise;
      } catch {
        // expected
      }
    });

    expect(mocks.txNotifications.notifyFailed).toHaveBeenCalledWith({ hash: "0xdead", label: "Burn post", error: "revert" });
  });

  it("reports missing receipt", async () => {
    const get = setup();

    const wait = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockResolvedValue({ hash: "0xabc", wait });

    let result: any;
    await act(async () => {
      result = await get().runContractTx("Comment", send as any);
    });

    expect(result).toBeUndefined();
    expect(mocks.txNotifications.notifyFailed).toHaveBeenCalledWith({
      hash: "0xabc",
      label: "Comment",
      error: "Transaction receipt unavailable."
    });
    expect(mocks.setStatus).toHaveBeenCalledWith("Transaction receipt unavailable.");
  });
});
