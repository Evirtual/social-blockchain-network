import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ComposerCard } from "./ComposerCard";

describe("ComposerCard", () => {
  it("wires draft handlers and media previews", () => {
    const onDraftFieldChange = vi.fn();
    const onImageUrlChange = vi.fn();
    const onSelectFile = vi.fn();
    const onClearImage = vi.fn();
    const onPost = vi.fn();

    const draft = {
      body: "hi",
      imageUrl: "",
      imageDataUrl: "data:image/png;base64,AAA",
      mimeType: "image/png"
    } as any;

    render(
      <ComposerCard
        selfAvatarHue={123}
        ipfsConfigured={true}
        draft={draft}
        isImageLoading={false}
        onDraftFieldChange={onDraftFieldChange}
        onImageUrlChange={onImageUrlChange}
        onSelectFile={onSelectFile}
        onClearImage={onClearImage}
        onPost={onPost}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("What's happening?"), { target: { value: "next" } });
    expect(onDraftFieldChange).toHaveBeenCalledWith("body", "next");

    fireEvent.change(screen.getByPlaceholderText(/Media URL/), { target: { value: "https://example.com/a.png" } });
    expect(onImageUrlChange).toHaveBeenCalledWith("https://example.com/a.png");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClearImage).toHaveBeenCalledTimes(1);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const f = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [f] } });
    expect(onSelectFile).toHaveBeenCalledWith(f);

    fireEvent.change(fileInput, { target: { files: [] } });
    expect(onSelectFile).toHaveBeenLastCalledWith(null);

    expect(screen.getByAltText("Selected upload")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(onPost).toHaveBeenCalledTimes(1);
  });

  it("shows video preview for blob URLs", () => {
    const draft = {
      body: "",
      imageUrl: "",
      imageDataUrl: "blob:video",
      mimeType: "video/mp4"
    } as any;

    render(
      <ComposerCard
        selfAvatarHue={0}
        ipfsConfigured={false}
        draft={draft}
        isImageLoading={true}
        onDraftFieldChange={() => undefined}
        onImageUrlChange={() => undefined}
        onSelectFile={() => undefined}
        onClearImage={() => undefined}
        onPost={() => undefined}
      />
    );

    expect(document.querySelector("video.image-preview")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
  });
});
