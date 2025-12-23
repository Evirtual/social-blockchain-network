import { beforeEach, describe, expect, it, vi } from "vitest";

const pinataPinFile = vi.fn();
const pinataPinJson = vi.fn();

vi.mock("../ipfs", () => ({
  pinataPinFile: (...args: any[]) => pinataPinFile(...args),
  pinataPinJson: (...args: any[]) => pinataPinJson(...args)
}));

import { buildIpfsTokenUri } from "./ipfsTokenUri";

describe("buildIpfsTokenUri", () => {
  beforeEach(() => {
    pinataPinFile.mockReset();
    pinataPinJson.mockReset();
    vi.restoreAllMocks();
  });

  it("pins a provided image blob and metadata", async () => {
    pinataPinFile.mockResolvedValueOnce({ IpfsHash: "img" });
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta" });

    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: "", imageDataUrl: "" },
      imageBlob: new Blob(["x"], { type: "image/png" }),
      imageFilename: "x.png"
    });

    expect(res.tokenUri).toBe("ipfs://meta");
    expect(res.imageRef).toBe("ipfs://img");
    expect(res.animationRef).toBe("");
    expect(pinataPinJson).toHaveBeenCalledTimes(1);
    const [metaArg] = pinataPinJson.mock.calls.at(-1)!;
    expect(metaArg.image).toBe("ipfs://img");
    expect(metaArg.animation_url).toBeUndefined();
  });

  it("pins a provided video blob as animation_url", async () => {
    pinataPinFile.mockResolvedValueOnce({ IpfsHash: "vid" });
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta2" });

    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: "", imageDataUrl: "" },
      imageBlob: { type: "video/mp4" } as any,
      imageFilename: "x.mp4"
    });

    expect(res.tokenUri).toBe("ipfs://meta2");
    expect(res.imageRef).toBe("");
    expect(res.animationRef).toBe("ipfs://vid");
    expect(pinataPinJson).toHaveBeenCalledTimes(1);
    const [metaArg] = pinataPinJson.mock.calls.at(-1)!;
    expect(metaArg.animation_url).toBe("ipfs://vid");
    expect(metaArg.image).toBe("");
  });

  it("uses default filename when none provided", async () => {
    pinataPinFile.mockResolvedValueOnce({ IpfsHash: "img" });
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta" });

    await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: "", imageDataUrl: "" },
      imageBlob: new Blob(["x"], { type: "image/png" }),
      imageFilename: ""
    });

    expect(pinataPinFile).toHaveBeenCalledTimes(1);
    expect(pinataPinFile.mock.calls[0][1]).toBe("post-media");
  });

  it("fetches draft.imageUrl, pins media when fetch succeeds", async () => {
    pinataPinFile.mockResolvedValueOnce({ IpfsHash: "fromUrl" });
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta3" });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["x"], { type: "video/webm" })
    } as any);

    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: "https://x/video.webm", imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.animationRef).toBe("ipfs://fromUrl");
    expect(res.imageRef).toBe("");
  });

  it("fetches draft.imageUrl, pins media as image when fetched blob is not video", async () => {
    pinataPinFile.mockResolvedValueOnce({ IpfsHash: "fromUrlImg" });
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "metaImg" });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["x"], { type: "image/png" })
    } as any);

    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: "https://x/image.png", imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.imageRef).toBe("ipfs://fromUrlImg");
    expect(res.animationRef).toBe("");
  });

  it("uses original URL when fetch fails and it looks like video", async () => {
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta4" });
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("nope"));

    const url = "https://cdn.example/file.mp4";
    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: url, imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.animationRef).toBe(url);
    expect(res.imageRef).toBe("");
  });

  it("uses original URL when fetch returns non-ok", async () => {
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta5" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as any);

    const url = "https://cdn.example/file.png";
    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: url, imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.imageRef).toBe(url);
    expect(res.animationRef).toBe("");
  });

  it("uses original URL as animationRef when fetch returns non-ok for video url", async () => {
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta6" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as any);

    const url = "https://cdn.example/file.mp4";
    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: url, imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.animationRef).toBe(url);
    expect(res.imageRef).toBe("");
  });

  it("treats ipfs:// video URLs as animationRef when fetch returns non-ok", async () => {
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta8" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as any);

    const url = "ipfs://QmVideo.mp4";
    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: url, imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.animationRef).toBe(url);
    expect(res.imageRef).toBe("");
  });

  it("treats ipfs:// non-video URLs as imageRef when fetch returns non-ok", async () => {
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta9" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as any);

    const url = "ipfs://QmImage.png";
    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: url, imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.imageRef).toBe(url);
    expect(res.animationRef).toBe("");
  });

  it("pins a provided blob without type as imageRef", async () => {
    pinataPinFile.mockResolvedValueOnce({ IpfsHash: "imgNoType" });
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "metaNoType" });

    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: "", imageDataUrl: "" },
      imageBlob: {} as any,
      imageFilename: "x.bin"
    });

    expect(res.imageRef).toBe("ipfs://imgNoType");
    expect(res.animationRef).toBe("");
  });

  it("uses original URL as imageRef when fetch throws for image url", async () => {
    pinataPinJson.mockResolvedValueOnce({ IpfsHash: "meta7" });
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("nope"));

    const url = "https://cdn.example/file.png";
    const res = await buildIpfsTokenUri({
      draft: { title: "t", body: "b", imageUrl: url, imageDataUrl: "" },
      imageBlob: null,
      imageFilename: "ignored"
    });

    expect(res.imageRef).toBe(url);
    expect(res.animationRef).toBe("");
  });
});
