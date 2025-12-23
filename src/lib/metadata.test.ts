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

  it("fetchTokenMetadata parses base64 uri", async () => {
    const draft: Draft = { title: "n", body: "d", imageUrl: "https://x/y.png", imageDataUrl: "" };
    const uri = createMetadataUri(draft);

    const meta = await fetchTokenMetadata(uri);
    expect(meta.name).toBe("n");
    expect(meta.description).toBe("d");
    expect(meta.image).toBe("https://x/y.png");
  });

  it("fetchTokenMetadata returns {} on fetch failure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockRejectedValueOnce(new Error("net"));
    const meta = await fetchTokenMetadata("https://example.com/meta.json");
    expect(meta).toEqual({});
    fetchSpy.mockRestore();
  });
});
