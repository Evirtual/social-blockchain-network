import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

function stubEnv(key: string, value: string | undefined) {
  if (typeof value === "undefined") vi.stubEnv(key, "");
  else vi.stubEnv(key, value);
}

describe("ContractContext", () => {
  it("throws when used outside provider", async () => {
    vi.resetModules();
    const { useContract } = await import("./ContractContext");

     const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function Bad() {
      useContract();
      return null;
    }

    try {
      expect(() => render(<Bad />)).toThrow(/useContract must be used within <ContractProvider>/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("refreshes contract state and withdrawable tips", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    const setStatus = vi.fn();
    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus }) }));

    const provider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async (_addr: string) => "0x123"
    };

    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));

    const withdrawableOf = vi.fn().mockResolvedValue(5n);
    vi.doMock("../contracts/socialPosts", () => ({
      getSocialContract: () => ({ withdrawableOf })
    }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return (
        <div>
          <div data-testid="deployed">{String(c.contractDeployed)}</div>
          <div data-testid="tips">{c.withdrawableTipsWei.toString()}</div>
        </div>
      );
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("deployed")).toHaveTextContent("true"));
    expect(screen.getByTestId("tips")).toHaveTextContent("5");
  });

  it("sets ownerAddress to null when contract address is missing", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS", undefined);
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", undefined);

    const setStatus = vi.fn();
    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus }) }));

    const provider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async (_addr: string) => "0x"
    };

    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="owner">{String(c.ownerAddress)}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("owner")).toHaveTextContent("null"));
    expect(setStatus).toHaveBeenCalled();
  });

  it("sets ownerAddress when owner() succeeds", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {};
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));

    vi.doMock("../contracts/socialPosts", () => ({
      getSocialContract: () => ({ owner: async () => "0x000000000000000000000000000000000000BEEF" })
    }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="owner">{String(c.ownerAddress)}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("owner")).toHaveTextContent("0x000000000000000000000000000000000000BEEF")
    );
  });

  it("requireContractAddress throws when missing", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS", undefined);
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", undefined);

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: null, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div>{c.requireContractAddress()}</div>;
    }

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <ContractProvider>
            <Consumer />
          </ContractProvider>
        )
      ).toThrow(/Missing contract address/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("requireContractAddress parses hex chainId", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: {}, chainId: "0x7a69", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="addr">{c.requireContractAddress()}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    expect(screen.getByTestId("addr")).toHaveTextContent("0x0000000000000000000000000000000000000001");
  });

  it("requireContractAddress parses uppercase hex chainId", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: {}, chainId: "0X7A69", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="addr">{c.requireContractAddress()}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    expect(screen.getByTestId("addr")).toHaveTextContent("0x0000000000000000000000000000000000000001");
  });

  it("requireContractAddress falls back to legacy address when chain is unknown", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS", "0x00000000000000000000000000000000000000aa");
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", undefined);

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: {}, chainId: "99999", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="addr">{c.requireContractAddress()}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    expect(screen.getByTestId("addr")).toHaveTextContent("0x00000000000000000000000000000000000000aa");
  });

  it("requireContractAddress uses legacy address when chainId is null", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS", "0x00000000000000000000000000000000000000aa");
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", undefined);

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: {}, chainId: null, walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="addr">{c.requireContractAddress()}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    expect(screen.getByTestId("addr")).toHaveTextContent("0x00000000000000000000000000000000000000aa");
  });

  it("requireContractAddress falls back to network chainId when chainId is invalid", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");
    stubEnv("VITE_CONTRACT_ADDRESS", undefined);

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async (_addr: string) => "0x123"
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "0xZZ", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      const [addr, setAddr] = React.useState<string>("");

      React.useEffect(() => {
        void (async () => {
          await c.refreshContractState();
          setAddr(c.requireContractAddress());
        })();
      }, [c]);

      return <div data-testid="addr">{addr}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("addr")).toHaveTextContent("0x0000000000000000000000000000000000000001")
    );
  });

  it("requireContractAddress throws without chainId hint when chain is unknown", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS", undefined);
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", undefined);

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: {}, chainId: null, walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div>{c.requireContractAddress()}</div>;
    }

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <ContractProvider>
            <Consumer />
          </ContractProvider>
        )
      ).toThrow(/Missing contract address/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("requireContractAddress falls back to network chainId when decimal chainId is invalid", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");
    stubEnv("VITE_CONTRACT_ADDRESS", undefined);

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async (_addr: string) => "0x123"
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "not-a-number", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      const [addr, setAddr] = React.useState<string>("");

      React.useEffect(() => {
        void (async () => {
          await c.refreshContractState();
          setAddr(c.requireContractAddress());
        })();
      }, [c]);

      return <div data-testid="addr">{addr}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("addr")).toHaveTextContent("0x0000000000000000000000000000000000000001")
    );
  });

  it("ensureContractDeployedOnCurrentNetwork marks not deployed when code is empty", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {
      getCode: async (_addr: string) => "0x",
      getSigner: async () => ({})
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        void (async () => {
          try {
            await c.ensureContractDeployedOnCurrentNetwork();
          } catch {
            // ignore
          }
        })();
      }, [c]);

      return <div data-testid="deployed">{String(c.contractDeployed)}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("deployed")).toHaveTextContent("false"));
  });

  it("ensureContractDeployedOnCurrentNetwork marks not deployed when code is falsy", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {
      getCode: async (_addr: string) => ""
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        void (async () => {
          try {
            await c.ensureContractDeployedOnCurrentNetwork();
          } catch {
            // ignore
          }
        })();
      }, [c]);

      return <div data-testid="deployed">{String(c.contractDeployed)}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("deployed")).toHaveTextContent("false"));
  });

  it("ensureContractDeployedOnCurrentNetwork marks deployed when code is present", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {
      getCode: async (_addr: string) => "0x123"
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      const [err, setErr] = React.useState<string>("");

      React.useEffect(() => {
        void (async () => {
          try {
            await c.ensureContractDeployedOnCurrentNetwork();
          } catch (e) {
            setErr(String(e));
          }
        })();
      }, [c]);

      return (
        <div>
          <div data-testid="err">{err}</div>
          <div data-testid="deployed">{String(c.contractDeployed)}</div>
        </div>
      );
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("deployed")).toHaveTextContent("true"));
    expect(screen.getByTestId("err")).toHaveTextContent("");
  });

  it("ensureContractDeployedOnCurrentNetwork throws when no provider is present", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: null, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      const [msg, setMsg] = React.useState<string>("");

      React.useEffect(() => {
        void (async () => {
          try {
            await c.ensureContractDeployedOnCurrentNetwork();
          } catch (e) {
            setMsg((e as Error).message);
          }
        })();
      }, [c]);

      return <div data-testid="msg">{msg}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("msg")).toHaveTextContent("Wallet not found."));
  });

  it("getWriteContract throws when no provider is present", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: null, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      const [msg, setMsg] = React.useState<string>("");

      React.useEffect(() => {
        void (async () => {
          try {
            await c.getWriteContract();
          } catch (e) {
            setMsg((e as Error).message);
          }
        })();
      }, [c]);

      return <div data-testid="msg">{msg}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("msg")).toHaveTextContent("Wallet not found."));
  });

  it("getReadContract throws when no provider is present", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: null, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      const [msg, setMsg] = React.useState<string>("");

      React.useEffect(() => {
        void (async () => {
          try {
            await c.getReadContract();
          } catch (e) {
            setMsg((e as Error).message);
          }
        })();
      }, [c]);

      return <div data-testid="msg">{msg}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("msg")).toHaveTextContent("Wallet not found."));
  });

  it("getWriteContract uses signer and address", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const signer = { kind: "signer" };
    const provider = {
      getSigner: async () => signer
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));

    const getSocialContract = vi.fn().mockReturnValue({});
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      const [ok, setOk] = React.useState(false);

      React.useEffect(() => {
        void (async () => {
          await c.getWriteContract();
          setOk(true);
        })();
      }, [c]);

      return <div data-testid="ok">{String(ok)}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("ok")).toHaveTextContent("true"));
    expect(getSocialContract).toHaveBeenCalledWith(
      "0x0000000000000000000000000000000000000001",
      signer
    );
  });

  it("refreshContractState sets tips to 0 when walletAddress is missing", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async (_addr: string) => "0x123"
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: null })
    }));

    const withdrawableOf = vi.fn();
    vi.doMock("../contracts/socialPosts", () => ({
      getSocialContract: () => ({ withdrawableOf })
    }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="tips">{c.withdrawableTipsWei.toString()}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("tips")).toHaveTextContent("0"));
    expect(withdrawableOf).not.toHaveBeenCalled();
  });

  it("refreshContractState sets contractDeployed to null when getCode throws", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const provider = {
      getNetwork: async () => ({ chainId: 31337n }),
      getCode: async (_addr: string) => {
        throw new Error("boom");
      }
    };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: null })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    function Consumer() {
      const c = useContract();
      return <div data-testid="deployed">{String(c.contractDeployed)}</div>;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(screen.getByTestId("deployed")).toHaveTextContent("null"));
  });

  it("shows a status hint when wallet is connected but no contract address is configured", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS", undefined);
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", undefined);

    const setStatus = vi.fn();
    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus }) }));
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider: {}, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider } = await import("./ContractContext");

    render(
      <ContractProvider>
        <div />
      </ContractProvider>
    );

    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith(
        "Wallet connected, but no contract address is configured for this network. Set VITE_CONTRACT_ADDRESS_* in .env.local, then restart the dev server."
      )
    );
  });

  it("ensureContractDeployedOnCurrentNetwork caches successful checks", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    const setStatus = vi.fn();
    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus }) }));

    const getCode = vi.fn(async (_addr: string) => "0x123");
    const provider = { getCode, getNetwork: async () => ({ chainId: 31337n }) };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    const ref: { current: any } = { current: null };
    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        ref.current = c;
      });
      return null;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(ref.current).toBeTruthy());

    // The provider may be queried during initial refreshContractState().
    // Clear calls so we only count calls from this test's explicit ensure() calls.
    getCode.mockClear();

    await act(async () => {
      await ref.current.ensureContractDeployedOnCurrentNetwork();
    });
    await waitFor(() => expect(ref.current.contractDeployed).toBe(true));

    await act(async () => {
      await ref.current.ensureContractDeployedOnCurrentNetwork();
    });

    expect(getCode).toHaveBeenCalledTimes(1);
    expect(setStatus).not.toHaveBeenCalledWith(
      "RPC error while verifying contract; proceeding with last known deployed state."
    );
  });

  it("ensureContractDeployedOnCurrentNetwork retries on truncated JSON then succeeds", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    const setStatus = vi.fn();
    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus }) }));

    const getCode = vi.fn(async (_addr: string) => "0x123");
    const provider = { getCode, getNetwork: async () => ({ chainId: 31337n }) };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    const ref: { current: any } = { current: null };
    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        ref.current = c;
      });
      return null;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(ref.current).toBeTruthy());

    // Reset call history from initial refreshContractState().
    getCode.mockClear();

    // First call fails due to truncated JSON, retry succeeds.
    getCode
      .mockRejectedValueOnce(new Error("Unterminated string in JSON at position 10"))
      .mockResolvedValueOnce("0x123");

    await act(async () => {
      await ref.current.ensureContractDeployedOnCurrentNetwork();
    });

    expect(getCode).toHaveBeenCalledTimes(2);
  });

  it("ensureContractDeployedOnCurrentNetwork retries when getCode throws a truncated JSON string", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const getCode = vi.fn(async (_addr: string) => "0x123");
    const provider = { getCode, getNetwork: async () => ({ chainId: 31337n }) };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    const ref: { current: any } = { current: null };
    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        ref.current = c;
      });
      return null;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(ref.current).toBeTruthy());

    // Reset call history from initial refreshContractState().
    getCode.mockClear();

    getCode
      .mockRejectedValueOnce("Unterminated string in JSON at position 10")
      .mockResolvedValueOnce("0x123");

    await act(async () => {
      await ref.current.ensureContractDeployedOnCurrentNetwork();
    });

    expect(getCode).toHaveBeenCalledTimes(2);
  });

  it("ensureContractDeployedOnCurrentNetwork treats undefined rejection reasons as non-truncated", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const getCode = vi.fn(async (_addr: string) => "0x123");
    const provider = { getCode, getNetwork: async () => ({ chainId: 31337n }) };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    const ref: { current: any } = { current: null };
    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        ref.current = c;
      });
      return null;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(ref.current).toBeTruthy());

    // Reset call history from initial refreshContractState().
    getCode.mockClear();
    getCode.mockRejectedValueOnce(undefined);

    await expect(ref.current.ensureContractDeployedOnCurrentNetwork()).rejects.toThrow(
      /contract not found on this network/i
    );

    expect(getCode).toHaveBeenCalledTimes(1);
  });

  it("ensureContractDeployedOnCurrentNetwork proceeds when RPC keeps returning malformed JSON but deployment was already verified", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    const setStatus = vi.fn();
    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus }) }));

    let nowMs = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => nowMs);

    const getCode = vi.fn(async (_addr: string) => "0x123");
    const provider = { getCode, getNetwork: async () => ({ chainId: 31337n }) };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    const ref: { current: any } = { current: null };
    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        ref.current = c;
      });
      return null;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(ref.current).toBeTruthy());

    // Reset call history from initial refreshContractState().
    getCode.mockClear();

    // First verify deployment successfully.
    await act(async () => {
      await ref.current.ensureContractDeployedOnCurrentNetwork();
    });
    await waitFor(() => expect(ref.current.contractDeployed).toBe(true));
    expect(getCode).toHaveBeenCalledTimes(1);

    // Then simulate an RPC that consistently returns truncated JSON.
    getCode.mockReset().mockRejectedValue(new Error("rpc down"));

    // Move time forward so cache doesn't short-circuit.
    nowMs = 61_000;

    await act(async () => {
      await ref.current.ensureContractDeployedOnCurrentNetwork();
    });

    expect(setStatus).toHaveBeenCalledWith(
      "RPC error while verifying contract; proceeding with last known deployed state."
    );

    nowSpy.mockRestore();
  });

  it("ensureContractDeployedOnCurrentNetwork throws when RPC fails before deployment is verified", async () => {
    vi.resetModules();
    stubEnv("VITE_CONTRACT_ADDRESS_LOCAL", "0x0000000000000000000000000000000000000001");

    vi.doMock("./StatusContext", () => ({ useStatus: () => ({ setStatus: vi.fn() }) }));

    const getCode = vi.fn(async () => {
      throw new Error("rpc down");
    });
    const provider = { getCode, getNetwork: async () => ({ chainId: 31337n }) };
    vi.doMock("./WalletContext", () => ({
      useWallet: () => ({ provider, chainId: "31337", walletAddress: "0xabc" })
    }));
    vi.doMock("../contracts/socialPosts", () => ({ getSocialContract: vi.fn() }));

    const { ContractProvider, useContract } = await import("./ContractContext");

    const ref: { current: any } = { current: null };
    function Consumer() {
      const c = useContract();
      React.useEffect(() => {
        ref.current = c;
      });
      return null;
    }

    render(
      <ContractProvider>
        <Consumer />
      </ContractProvider>
    );

    await waitFor(() => expect(ref.current).toBeTruthy());
    getCode.mockClear();

    await expect(ref.current.ensureContractDeployedOnCurrentNetwork()).rejects.toThrow(/rpc down/i);
  });
});
