import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getIpfsGatewayBase,
  hasPinata,
  ipfsToHttp,
  pinataPinFile,
  pinataPinJson
} from "./ipfs";

function stubEnv(key: string, value: string | undefined) {
  if (typeof value === "undefined") vi.stubEnv(key, "");
  else vi.stubEnv(key, value);
}

describe("ipfs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("falls back to Pinata gateway when env is undefined", () => {
    vi.stubEnv("VITE_IPFS_GATEWAY", undefined as any);
    expect(getIpfsGatewayBase()).toBe("https://gateway.pinata.cloud/ipfs/");
  });

  it("computes gateway base with trailing slash", () => {
    stubEnv("VITE_IPFS_GATEWAY", "https://example.com/ipfs");
    expect(getIpfsGatewayBase()).toBe("https://example.com/ipfs/");

    stubEnv("VITE_IPFS_GATEWAY", "https://example.com/ipfs/");
    expect(getIpfsGatewayBase()).toBe("https://example.com/ipfs/");
  });

  it("converts ipfs:// URIs to HTTP", () => {
    stubEnv("VITE_IPFS_GATEWAY", "https://gw.example/ipfs/");
    expect(ipfsToHttp("ipfs://bafy123")).toBe("https://gw.example/ipfs/bafy123");
    expect(ipfsToHttp("ipfs://ipfs/bafy456")).toBe("https://gw.example/ipfs/bafy456");
    expect(ipfsToHttp("https://site.example/x")).toBe("https://site.example/x");
  });

  it("detects pinata auth via env", () => {
    stubEnv("VITE_PINATA_JWT", undefined);
    expect(hasPinata()).toBe(false);
    stubEnv("VITE_PINATA_JWT", "jwt");
    expect(hasPinata()).toBe(true);
  });

  it("pinataPinFile throws without jwt", async () => {
    stubEnv("VITE_PINATA_JWT", undefined);
    await expect(pinataPinFile(new Blob(["x"], { type: "text/plain" }), "x.txt")).rejects.toThrow(
      /Missing VITE_PINATA_JWT/
    );
  });

  it("pinataPinFile uploads and returns json", async () => {
    stubEnv("VITE_PINATA_JWT", "jwt");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ IpfsHash: "Qm1" }) } as any);

    const res = await pinataPinFile(new Blob(["hi"], { type: "text/plain" }), "a.txt");
    expect(res.IpfsHash).toBe("Qm1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as any).method).toBe("POST");
    expect((init as any).headers.Authorization).toBe("Bearer jwt");
  });

  it("pinataPinFile errors include response text", async () => {
    stubEnv("VITE_PINATA_JWT", "jwt");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "bad"
    } as any);

    await expect(pinataPinFile(new Blob(["x"]), "x")).rejects.toThrow(/400/);
  });

  it("pinataPinJson uploads and returns json", async () => {
    stubEnv("VITE_PINATA_JWT", "jwt");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ IpfsHash: "Qm2" }) } as any);

    const res = await pinataPinJson({ hello: "world" });
    expect(res.IpfsHash).toBe("Qm2");
    const [, init] = fetchMock.mock.calls[0];
    expect((init as any).headers.Authorization).toBe("Bearer jwt");
    expect((init as any).headers["Content-Type"]).toBe("application/json");
  });

  it("pinataPinJson errors include response text", async () => {
    stubEnv("VITE_PINATA_JWT", "jwt");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "bad"
    } as any);

    await expect(pinataPinJson({ a: 1 })).rejects.toThrow(/500/);
  });

  it("pinataPinJson throws without jwt", async () => {
    stubEnv("VITE_PINATA_JWT", undefined);
    await expect(pinataPinJson({ a: 1 })).rejects.toThrow(/Missing VITE_PINATA_JWT/);
  });
});

