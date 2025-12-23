import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

const setStatus = vi.fn();
vi.mock("./StatusContext", () => ({
  useStatus: () => ({ setStatus })
}));

const createdProviders: unknown[] = [];
const sendMock = vi.fn();
const getSignerMock = vi.fn();
const getNetworkMock = vi.fn();
const getBalanceMock = vi.fn();

vi.mock("ethers", () => {
  class BrowserProvider {
    constructor(_eth: any) {
      createdProviders.push(this);
    }
    send(...args: any[]) {
      return sendMock(...args);
    }
    getSigner() {
      return getSignerMock();
    }
    getNetwork() {
      return getNetworkMock();
    }
    getBalance(addr: string) {
      return getBalanceMock(addr);
    }
  }

  return {
    ethers: {
      BrowserProvider,
      formatEther: (_wei: any) => "1"
    }
  };
});

import { WalletProvider, useWallet } from "./WalletContext";

function Consumer() {
  const ctx = useWallet();
  return (
    <div>
      <div data-testid="addr">{ctx.walletAddress ?? ""}</div>
      <div data-testid="chain">{ctx.chainId ?? ""}</div>
      <div data-testid="name">{ctx.networkName ?? ""}</div>
      <div data-testid="bal">{ctx.nativeBalance}</div>
      <div data-testid="epoch">{String(ctx.walletEpoch)}</div>
      <button onClick={() => ctx.connectWallet()}>connect</button>
      <button onClick={() => ctx.disconnectWallet()}>disconnect</button>
      <button onClick={() => ctx.refreshWalletPanel()}>refresh</button>
    </div>
  );
}

function setEthereumStub() {
  const handlers: Record<string, Function> = {};
  const removeListener = vi.fn((evt: string) => {
    delete handlers[evt];
  });
  (window as any).ethereum = {
    on: (evt: string, fn: Function) => {
      handlers[evt] = fn;
    },
    removeListener,
    __handlers: handlers
  };
  return { handlers, removeListener };
}

beforeEach(() => {
  setStatus.mockClear();
  sendMock.mockReset();
  getSignerMock.mockReset();
  getNetworkMock.mockReset();
  getBalanceMock.mockReset();
  createdProviders.length = 0;

  localStorage.removeItem("socialBlockchainNetwork.walletDisconnected");
  (window as any).ethereum = undefined;
});

describe("WalletContext", () => {
  it("defaults auto-connect to enabled when localStorage read throws", async () => {
    setEthereumStub();

    const getItemSpy = vi.spyOn(window.Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("no storage");
    });

    sendMock.mockImplementation((method: string) => {
      if (method === "eth_accounts") return ["0xabc"];
      return [];
    });
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    });
    expect(setStatus).toHaveBeenCalledWith("Wallet connected.");

    getItemSpy.mockRestore();
  });

  it("connectWallet returns null when provider missing", async () => {
    vi.resetModules();
    (window as any).ethereum = undefined;
    const { WalletProvider, useWallet } = await import("./WalletContext");

    function C() {
      const w = useWallet();
      return <button onClick={() => w.connectWallet()}>go</button>;
    }

    render(
      <WalletProvider>
        <C />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByText("go").click();
    });
    expect(setStatus).toHaveBeenCalledWith("Install a wallet like MetaMask to continue.");
  });

  it("connectWallet returns null when request is rejected", async () => {
    setEthereumStub();
    sendMock.mockImplementation(() => {
      throw new Error("rejected");
    });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    expect(setStatus).toHaveBeenCalledWith("Wallet connection rejected.");
  });

  it("connectWallet success path updates state and localStorage", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "1");
    setEthereumStub();

    sendMock.mockImplementation((method: string) => {
      if (method === "eth_accounts") return ["0xabc"]; // bootstrap
      if (method === "eth_requestAccounts") return []; // connect
      return [];
    });

    getSignerMock.mockResolvedValue({ getAddress: async () => "0xabc" });
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });
    getBalanceMock.mockResolvedValue(1n);

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    });
    expect(screen.getByTestId("chain")).toHaveTextContent("1");
    expect(screen.getByTestId("name")).toHaveTextContent("mainnet");
    expect(screen.getByTestId("bal")).toHaveTextContent("1.0000");
    expect(localStorage.getItem("socialBlockchainNetwork.walletDisconnected")).toBe("0");
  });

  it("connectWallet ignores errors when persisting auto-connect flag", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "1");
    setEthereumStub();

    const setItemSpy = vi.spyOn(window.Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("write failed");
    });

    sendMock.mockImplementation((method: string) => {
      if (method === "eth_accounts") return ["0xabc"]; // bootstrap
      if (method === "eth_requestAccounts") return []; // connect
      return [];
    });

    getSignerMock.mockResolvedValue({ getAddress: async () => "0xabc" });
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });
    getBalanceMock.mockResolvedValue(1n);

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    });

    setItemSpy.mockRestore();
  });

  it("connectWallet does not block on balance and sets placeholder on failure", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "1");
    setEthereumStub();

    sendMock.mockImplementation((method: string) => {
      if (method === "eth_accounts") return ["0xabc"]; // bootstrap
      if (method === "eth_requestAccounts") return []; // connect
      return [];
    });

    getSignerMock.mockResolvedValue({ getAddress: async () => "0xabc" });
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });
    getBalanceMock.mockRejectedValue(new Error("nope"));

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByText("connect").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    });
    expect(screen.getByTestId("bal")).toHaveTextContent("—");
  });

  it("disconnectWallet clears local session", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    setEthereumStub();

    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });
    getBalanceMock.mockResolvedValue(1n);

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    act(() => {
      screen.getByText("disconnect").click();
    });

    expect(screen.getByTestId("addr")).toHaveTextContent("");
    expect(localStorage.getItem("socialBlockchainNetwork.walletDisconnected")).toBe("1");
    expect(setStatus).toHaveBeenCalledWith("Wallet disconnected");
  });

  it("disconnectWallet ignores errors when persisting disconnected flag", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    setEthereumStub();

    const setItemSpy = vi.spyOn(window.Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("write failed");
    });

    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });
    getBalanceMock.mockResolvedValue(1n);

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    act(() => {
      screen.getByText("disconnect").click();
    });

    expect(setStatus).toHaveBeenCalledWith("Wallet disconnected");

    setItemSpy.mockRestore();
  });

  it("bootstrap does not auto-connect when auto-connect is disabled", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "1");
    setEthereumStub();

    sendMock.mockImplementation((method: string) => {
      if (method === "eth_accounts") return ["0xabc"]; // would have connected
      return [];
    });
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(setStatus).toHaveBeenCalledWith("Wallet disconnected");
    });
    expect(screen.getByTestId("addr")).toHaveTextContent("");
  });

  it("bootstrap auto-connects when accounts exist and auto-connect enabled", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    setEthereumStub();

    sendMock.mockImplementation((method: string) => {
      if (method === "eth_accounts") return ["0xabc"]; // bootstrap
      return [];
    });
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    });
    expect(setStatus).toHaveBeenCalledWith("Wallet connected.");
    expect(Number(screen.getByTestId("epoch").textContent || "0")).toBeGreaterThan(0);
  });

  it("refreshWalletPanel returns early when disconnected", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "1");
    setEthereumStub();
    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    // Bootstrap always calls getNetwork; ignore that noise.
    await act(async () => {
      // flush effects
    });
    getNetworkMock.mockClear();
    getBalanceMock.mockClear();

    await act(async () => {
      screen.getByText("refresh").click();
    });

    expect(getNetworkMock).not.toHaveBeenCalled();
    expect(getBalanceMock).not.toHaveBeenCalled();
  });

  it("refreshWalletPanel de-dupes in-flight refreshes", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    setEthereumStub();

    sendMock.mockImplementation((method: string) => {
      if (method === "eth_accounts") return ["0xabc"]; // bootstrap
      return [];
    });

    // Let bootstrap complete, but block the *refresh* network call.
    getNetworkMock.mockResolvedValueOnce({ chainId: 1n, name: "mainnet" });

    let resolve!: (v: any) => void;
    const pending = new Promise<any>((r) => {
      resolve = r;
    });
    getBalanceMock.mockResolvedValue(1n);

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    });

    getNetworkMock.mockClear();
    getBalanceMock.mockClear();
    getNetworkMock.mockReturnValueOnce(pending as any);
    getBalanceMock.mockResolvedValueOnce(1n);

    await act(async () => {
      screen.getByText("refresh").click();
      screen.getByText("refresh").click();
    });

    expect(getNetworkMock).toHaveBeenCalledTimes(1);
    expect(getBalanceMock).toHaveBeenCalledTimes(1);

    resolve({ chainId: 1n, name: "mainnet" });
    await act(async () => {
      await pending;
    });
  });

  it("responds to chainChanged by recreating provider", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const { handlers } = setEthereumStub();

    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });
    getBalanceMock.mockResolvedValue(1n);

    createdProviders.length = 0;
    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    expect(createdProviders.length).toBe(1);
    await act(async () => {
      await handlers.chainChanged?.("0x2");
    });

    expect(createdProviders.length).toBe(2);
  });

  it("parses chainChanged decimal and invalid values", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const { handlers } = setEthereumStub();

    sendMock.mockResolvedValue([]);
    getNetworkMock
      .mockResolvedValueOnce({ chainId: 1n, name: "mainnet" })
      .mockResolvedValueOnce({ chainId: 10n, name: "ten" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      await handlers.chainChanged?.("10");
    });
    expect(screen.getByTestId("chain")).toHaveTextContent("10");

    await act(async () => {
      // Provider is recreated again; keep chainId null by failing the bootstrap getNetwork.
      getNetworkMock.mockRejectedValueOnce(new Error("fail"));
      await handlers.chainChanged?.("not-a-number");
    });
    expect(screen.getByTestId("chain")).toHaveTextContent("");
  });

  it("responds to accountsChanged when auto-connect disabled", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "1");
    const { handlers } = setEthereumStub();
    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      await handlers.accountsChanged?.(["0xabc"]);
    });

    expect(screen.getByTestId("addr")).toHaveTextContent("");
    expect(setStatus).toHaveBeenCalledWith("Wallet disconnected");
  });

  it("responds to accountsChanged with empty accounts", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const { handlers } = setEthereumStub();
    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      await handlers.accountsChanged?.([]);
    });

    expect(screen.getByTestId("addr")).toHaveTextContent("");
    expect(setStatus).toHaveBeenCalledWith("Wallet disconnected");
  });

  it("responds to accountsChanged with a new account and updates chain info", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const { handlers } = setEthereumStub();
    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 8453n, name: "base" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      await handlers.accountsChanged?.(["0xabc"]);
    });

    expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    expect(screen.getByTestId("chain")).toHaveTextContent("8453");
    expect(screen.getByTestId("name")).toHaveTextContent("base");
    expect(setStatus).toHaveBeenCalledWith("Wallet connected.");
  });

  it("ignores getNetwork errors during accountsChanged", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const { handlers } = setEthereumStub();

    sendMock.mockResolvedValue([]);
    getNetworkMock
      .mockResolvedValueOnce({ chainId: 1n, name: "mainnet" }) // bootstrap
      .mockRejectedValueOnce(new Error("no network")); // accountsChanged

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      await handlers.accountsChanged?.(["0xabc"]);
    });

    expect(screen.getByTestId("addr")).toHaveTextContent("0xabc");
    expect(setStatus).toHaveBeenCalledWith("Wallet connected.");
  });

  it("ignores errors thrown in chainChanged handler", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const { handlers } = setEthereumStub();

    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    createdProviders.length = 0;
    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    expect(createdProviders.length).toBe(1);
    setStatus.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await act(async () => {
      await handlers.chainChanged?.("0x2");
    });

    // If an error occurred, it should be caught and should not recreate the provider.
    expect(createdProviders.length).toBe(1);
  });

  it("removes ethereum listeners on unmount", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const { removeListener } = setEthereumStub();
    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    const { unmount } = render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });

  it("does not register listeners when ethereum lacks on()", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    (window as any).ethereum = {};

    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await waitFor(() => {
      // bootstrap still runs
      expect(setStatus).toHaveBeenCalled();
    });
  });

  it("handles ethereum becoming unavailable before effects run", async () => {
    localStorage.setItem("socialBlockchainNetwork.walletDisconnected", "0");
    const eth = { on: vi.fn(), removeListener: vi.fn() };
    let first = true;
    Object.defineProperty(window as any, "ethereum", {
      configurable: true,
      get() {
        if (first) {
          first = false;
          return eth;
        }
        return undefined;
      }
    });

    sendMock.mockResolvedValue([]);
    getNetworkMock.mockResolvedValue({ chainId: 1n, name: "mainnet" });

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>
    );

    await act(async () => {
      // flush effects
    });

    Object.defineProperty(window as any, "ethereum", {
      value: undefined,
      writable: true,
      configurable: true
    });
  });

  it("throws when used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Consumer />)).toThrow(/useWallet must be used/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
