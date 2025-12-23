import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Draft, Post } from "../types";
import { PostCard } from "./PostCard";

describe("PostCard", () => {
  const baseDraft: Draft = {
    title: "",
    body: "",
    imageUrl: "",
    imageDataUrl: ""
  };

  const basePost: Post = {
    tokenId: "1",
    title: "t",
    body: "Hello world",
    image: "",
    metadataURI: "ipfs://meta",
    author: "0x000000000000000000000000000000000000dEaD",
    likes: 0,
    comments: 0,
    shares: 0,
    tipsWei: 0n
  };

  it("renders author label and token link", () => {
    const post: Post = {
      ...basePost
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/Token #1/i)).toBeInTheDocument();
  });

  it("uses backgroundImage avatar when authorAvatarUrl is provided", () => {
    render(
      <MemoryRouter>
        <PostCard
          post={basePost}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          authorAvatarUrl="ipfs://avatar"
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    const avatar = document.querySelector(".avatar.small") as HTMLDivElement | null;
    expect(avatar).toBeTruthy();
    expect(avatar?.style.backgroundImage).toContain("ipfs.io/ipfs/avatar");
  });

  it("renders author label as plain text when post.author is missing", () => {
    const post: Post = {
      ...basePost,
      author: undefined
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Anonymous"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Anonymous" })).toBeNull();
  });

  it("copies mint tx hash when explorer URL is unavailable", () => {
    const writeText = vi.fn(async () => undefined);
    (navigator as any).clipboard = { writeText };

    const post: Post = {
      ...basePost,
      mintTxHash: "0xhash"
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    const link = screen.getByText("View mint transaction");
    fireEvent.click(link);
    expect(writeText).toHaveBeenCalledWith("0xhash");
  });

  it("calls onAction when Like and Save are clicked", () => {
    const onAction = vi.fn();

    const post: Post = {
      ...basePost,
      likes: 3,
      shares: 2,
      likedByMe: true,
      repostedByMe: true
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={onAction}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onAction).toHaveBeenCalledWith("1", "like");
    expect(onAction).toHaveBeenCalledWith("1", "share");
  });

  it("does not throw if clipboard is unavailable when explorer URL is unavailable", () => {
    delete (navigator as any).clipboard;

    const post: Post = {
      ...basePost,
      mintTxHash: "0xhash"
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(() => {
      fireEvent.click(screen.getByText("View mint transaction"));
    }).not.toThrow();
  });

  it("links to explorer when explorer URL is available", () => {
    const writeText = vi.fn(async () => undefined);
    (navigator as any).clipboard = { writeText };

    const post: Post = {
      ...basePost,
      mintTxHash: "0xhash"
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => "https://explorer/tx/0xhash"}
        />
      </MemoryRouter>
    );

    const link = screen.getByText("View mint transaction") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://explorer/tx/0xhash");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    fireEvent.click(link);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("shows mine actions + saved badge and wires handlers", () => {
    const onStartEditPost = vi.fn();
    const onBurn = vi.fn();
    const onTogglePanel = vi.fn();

    const post: Post = {
      ...basePost,
      contextTag: "saved",
      likedByMe: true,
      repostedByMe: true,
      likes: 3,
      shares: 2
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Me"
          authorHue={120}
          isMine
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={onTogglePanel}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={onStartEditPost}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={onBurn}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit post" }));
    expect(onStartEditPost).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Burn post" }));
    expect(onBurn).toHaveBeenCalledWith("1");

    fireEvent.click(screen.getByRole("button", { name: "Tip" }));
    expect(onTogglePanel).toHaveBeenCalledWith("tip");
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(onTogglePanel).toHaveBeenCalledWith("comment");
  });

  it("renders edit mode with preview and freeze", () => {
    const onSetEditDraft = vi.fn();
    const onFreezePost = vi.fn();
    const onEditSelectFile = vi.fn();

    render(
      <MemoryRouter>
        <PostCard
          post={basePost}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Me"
          authorHue={120}
          isMine
          editingTokenId="1"
          editDraft={{ ...baseDraft, body: "x", imageDataUrl: "data:image/png;base64,aaa" }}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={onSetEditDraft}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={onEditSelectFile}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={onFreezePost}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(screen.getByAltText("Edit preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Freeze" }));
    expect(onFreezePost).toHaveBeenCalledWith("1");

    const textarea = screen.getByPlaceholderText("Post text");
    fireEvent.change(textarea, { target: { value: "new" } });
    expect(onSetEditDraft).toHaveBeenCalled();

    const imageUrlInput = screen.getByPlaceholderText("Image URL");
    fireEvent.change(imageUrlInput, { target: { value: "ipfs://img" } });
    expect(onSetEditDraft).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: "ipfs://img", imageDataUrl: "" })
    );

    const fileInput = document.querySelector("input.file-input") as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [] } });
    expect(onEditSelectFile).toHaveBeenCalledWith(null);
  });

  it("does not render Freeze in edit mode when isMine is false", () => {
    render(
      <MemoryRouter>
        <PostCard
          post={basePost}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Me"
          authorHue={120}
          isMine={false}
          editingTokenId="1"
          editDraft={{ ...baseDraft, body: "x" }}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Freeze" })).toBeNull();

    const editBox = document.querySelector(".editBox");
    expect(editBox).toBeTruthy();
    expect(within(editBox as HTMLElement).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(editBox as HTMLElement).getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders blob video preview in edit mode", () => {
    render(
      <MemoryRouter>
        <PostCard
          post={basePost}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Me"
          authorHue={120}
          isMine
          editingTokenId="1"
          editDraft={{ ...baseDraft, body: "x", imageDataUrl: "blob:preview" }}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(document.querySelector("video.image-preview")).toBeTruthy();
  });

  it("renders body inline when there is no image or animation", () => {
    const post: Post = {
      ...basePost,
      image: "",
      animationUrl: undefined,
      mintTxHash: undefined
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    expect(document.querySelector(".post-body")).toBeTruthy();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders animationUrl as video with optional poster", () => {
    const post: Post = {
      ...basePost,
      image: "ipfs://poster",
      animationUrl: "ipfs://vid"
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    const video = document.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    expect(video?.getAttribute("poster")).toContain("ipfs.io/ipfs/poster");
  });

  it("renders animationUrl video without a poster when post.image is empty", () => {
    const post: Post = {
      ...basePost,
      image: "",
      animationUrl: "ipfs://vid"
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={null}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel={null}
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    const video = document.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    expect(video?.getAttribute("poster")).toBeNull();
  });

  it("defaults tip/comment draft values to empty strings", () => {
    render(
      <MemoryRouter>
        <PostCard
          post={basePost}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel="tip"
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    const tipInput = screen.getByPlaceholderText(/Tip amount/i) as HTMLInputElement;
    expect(tipInput.value).toBe("");

    render(
      <MemoryRouter>
        <PostCard
          post={basePost}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{}}
          commentDrafts={{}}
          openPanel="comment"
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={() => {}}
          onCommentDraftChange={() => {}}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={() => {}}
          onTip={() => {}}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    const commentInput = screen.getByPlaceholderText(/Write a comment/i) as HTMLInputElement;
    expect(commentInput.value).toBe("");
  });

  it("renders media and tip/comment forms", () => {
    const onTipDraftChange = vi.fn();
    const onCommentDraftChange = vi.fn();
    const onTip = vi.fn();
    const onAction = vi.fn();

    const post: Post = {
      ...basePost,
      image: "ipfs://img",
      tipsWei: 1_000_000_000_000n
    };

    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{ "1": "0.01" }}
          commentDrafts={{ "1": "hi" }}
          openPanel="tip"
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={onTipDraftChange}
          onCommentDraftChange={onCommentDraftChange}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={onAction}
          onTip={onTip}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    // Image rendered.
    expect(screen.getByAltText("Post image")).toBeInTheDocument();
    // Caption includes description when image exists.
    expect(screen.queryAllByText("View mint transaction").length).toBe(0);
    expect(document.querySelector(".postCaption")).toBeTruthy();
    expect(screen.getByText("Hello world")).toBeInTheDocument();

    const tipInput = screen.getByPlaceholderText(/Tip amount/i);
    fireEvent.change(tipInput, { target: { value: "0.02" } });
    expect(onTipDraftChange).toHaveBeenCalledWith("1", "0.02");
    const tipRow = tipInput.parentElement;
    if (!tipRow) throw new Error("Expected tip input to have a parent element");
    fireEvent.click(within(tipRow).getByRole("button", { name: "Tip" }));
    expect(onTip).toHaveBeenCalledWith("1");

    // Switch to comment panel by re-rendering.
    render(
      <MemoryRouter>
        <PostCard
          post={post}
          from="/"
          chainId={"8453"}
          walletAddress={"0xme"}
          authorLabel="Alice"
          authorHue={120}
          isMine={false}
          editingTokenId={null}
          editDraft={baseDraft}
          isEditImageLoading={false}
          tipDrafts={{ "1": "0.01" }}
          commentDrafts={{ "1": "hi" }}
          openPanel="comment"
          onTogglePanel={() => {}}
          onSetEditDraft={() => {}}
          onTipDraftChange={onTipDraftChange}
          onCommentDraftChange={onCommentDraftChange}
          onStartEditPost={() => {}}
          onCancelEditPost={() => {}}
          onSaveEditedPost={() => {}}
          onEditSelectFile={() => {}}
          onEditClearImage={() => {}}
          onAction={onAction}
          onTip={onTip}
          onBurn={() => {}}
          onFreezePost={() => {}}
          getNativeSymbol={() => "ETH"}
          getExplorerTxUrl={() => null}
        />
      </MemoryRouter>
    );

    const commentInput = screen.getByPlaceholderText(/Write a comment/i);
    fireEvent.change(commentInput, { target: { value: "ok" } });
    expect(onCommentDraftChange).toHaveBeenCalledWith("1", "ok");
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    expect(onAction).toHaveBeenCalledWith("1", "comment");
  });
});
