import { describe, expect, it, vi } from "vitest";
import type { Draft } from "../types";
import { createMetadataUri, decodeMetadataUri, fetchTokenMetadata } from "./metadata";

vi.mock("../ipfs", () => ({
  ipfsToHttp: (u: string) => u
}));

describe("metadata", () => {
  it("createMetadataUri encodes image metadata", () => {
    const draft: Draft = { title: "t", body: "b", imageUrl: "https://x/y.png", imageDataUrl: "" };
    const uri = createMetadataUri(draft);
    expect(uri.startsWith("data:application/json;base64,")).toBe(true);

    const decoded = decodeMetadataUri(uri);
    expect(decoded?.title).toBe("t");
    expect(decoded?.body).toBe("b");
    expect(decoded?.imageUrl).toBe("https://x/y.png");
  });

  it("createMetadataUri encodes video into animation_url", () => {
    const draft: Draft = { title: "t", body: "b", imageUrl: "ipfs://video.mp4", imageDataUrl: "" };
    const uri = createMetadataUri(draft);
    const decoded = decodeMetadataUri(uri);
    expect(decoded?.imageUrl).toBe("ipfs://video.mp4");
  });

  it("createMetadataUri treats non-video ipfs url as image", () => {
    const draft: Draft = { title: "t", body: "b", imageUrl: "ipfs://QmImage.png", imageDataUrl: "" };
    const uri = createMetadataUri(draft);
    const decoded = decodeMetadataUri(uri);
    expect(decoded?.imageUrl).toBe("ipfs://QmImage.png");
  });

  it("createMetadataUri treats http video URL as animation_url", () => {
    const draft: Draft = { title: "t", body: "b", imageUrl: "https://example.com/v.webm", imageDataUrl: "" };
    const uri = createMetadataUri(draft);
    const decoded = decodeMetadataUri(uri);
    expect(decoded?.imageUrl).toBe("https://example.com/v.webm");
  });

  it("decodeMetadataUri returns null for non-data URIs", () => {
    expect(decodeMetadataUri("https://example.com/meta.json")).toBeNull();
  });

  it("decodeMetadataUri returns null for invalid base64/json", () => {
    const bad = "data:application/json;base64,not-base64";
    expect(decodeMetadataUri(bad)).toBeNull();
  });

  it("decodeMetadataUri fills defaults when fields are missing", () => {
    const encoded = Buffer.from(JSON.stringify({ name: 123 })).toString("base64");
    const uri = `data:application/json;base64,${encoded}`;
    const decoded = decodeMetadataUri(uri);
    expect(decoded).toEqual({ title: "", body: "", imageUrl: "", imageDataUrl: "" });
  });

  it("fetchTokenMetadata parses base64 uri", async () => {
    const draft: Draft = { title: "n", body: "d", imageUrl: "https://x/y.png", imageDataUrl: "" };
    const uri = createMetadataUri(draft);

    const meta = await fetchTokenMetadata(uri);
    expect(meta.name).toBe("n");
    expect(meta.description).toBe("d");
    expect(meta.image).toBe("https://x/y.png");
  });

  it("fetchTokenMetadata drops non-string fields in base64 json", async () => {
    const encoded = Buffer.from(JSON.stringify({ name: 123, description: null, image: true, animation_url: [] })).toString(
      "base64"
    );
    const meta = await fetchTokenMetadata(`data:application/json;base64,${encoded}`);
    expect(meta).toEqual({ name: undefined, description: undefined, image: undefined, animation_url: undefined });
  });

  it("fetchTokenMetadata reads animation_url string from base64 json", async () => {
    const encoded = Buffer.from(
      JSON.stringify({ name: "n", description: "d", image: "ipfs://i", animation_url: "ipfs://v" })
    ).toString("base64");
    const meta = await fetchTokenMetadata(`data:application/json;base64,${encoded}`);
    expect(meta).toEqual({ name: "n", description: "d", image: "ipfs://i", animation_url: "ipfs://v" });
  });

  it("fetchTokenMetadata returns {} on fetch failure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockRejectedValueOnce(new Error("net"));
    const meta = await fetchTokenMetadata("https://example.com/meta.json");
    expect(meta).toEqual({});
    fetchSpy.mockRestore();
  });

  it("fetchTokenMetadata returns {} for empty tokenUri", async () => {
    expect(await fetchTokenMetadata("")).toEqual({});
  });

  it("fetchTokenMetadata returns {} for invalid base64 payload", async () => {
    const meta = await fetchTokenMetadata("data:application/json;base64,not-base64");
    expect(meta).toEqual({});
  });

  it("fetchTokenMetadata returns {} when fetch response is not ok", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) } as any);

    expect(await fetchTokenMetadata("ipfs://QmX")).toEqual({});
    fetchSpy.mockRestore();
  });

  it("fetchTokenMetadata tolerates missing fields in fetched json", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 123, description: null }) } as any);

    expect(await fetchTokenMetadata("https://example.com/meta.json")).toEqual({
      name: undefined,
      description: undefined,
      image: undefined,
      animation_url: undefined
    });

    fetchSpy.mockRestore();
  });

  it("fetchTokenMetadata reads string fields from fetched json", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "n", description: "d", image: "ipfs://i", animation_url: "ipfs://v" })
    } as any);

    expect(await fetchTokenMetadata("https://example.com/meta.json")).toEqual({
      name: "n",
      description: "d",
      image: "ipfs://i",
      animation_url: "ipfs://v"
    });

    fetchSpy.mockRestore();
  });
});
