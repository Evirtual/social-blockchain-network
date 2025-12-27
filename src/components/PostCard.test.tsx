import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { Draft, Post } from "../types";
import { PostCard } from "./PostCard";

type PostCardProps = Parameters<typeof PostCard>[0];

type RenderOptions = {
  post?: Partial<Post>;
  props?: Partial<PostCardProps>;
};

const baseDraft: Draft = { title: "", body: "", imageUrl: "", imageDataUrl: "" };

const basePost: Post = {
  tokenId: "1",
  title: "Test Title",
  body: "Hello world",
  image: "",
  metadataURI: "",
  likes: 0,
  comments: 0,
  shares: 0,
  tipsWei: 0n
};

function renderPostCard(options: RenderOptions = {}) {
  const post: Post = { ...basePost, ...options.post };

  const props: PostCardProps = {
    post,
    from: "/",
    chainId: "8453",
    walletAddress: null,
    authorLabel: "Alice",
    authorHue: 120,
    authorAvatarUrl: undefined,
    isMine: false,
    canModerate: false,

    editingTokenId: null,
    editDraft: baseDraft,
    isEditImageLoading: false,
    tipDrafts: {},
    commentDrafts: {},

    openPanel: null,
    onTogglePanel: vi.fn(),

    onSetEditDraft: vi.fn(),
    onTipDraftChange: vi.fn(),
    onCommentDraftChange: vi.fn(),

    onStartEditPost: vi.fn(),
    onCancelEditPost: vi.fn(),
    onSaveEditedPost: vi.fn(),
    onEditSelectFile: vi.fn(),
    onEditClearImage: vi.fn(),

    onAction: vi.fn(),
    onTip: vi.fn(),
    onBurn: vi.fn(),
    onFreezePost: vi.fn(),

    getNativeSymbol: vi.fn(() => "ETH"),
    getExplorerTxUrl: vi.fn(() => null),

    ...options.props
  };

  const rtl = render(
    <MemoryRouter>
      <PostCard {...props} />
    </MemoryRouter>
  );

  return { ...rtl, props, post };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("PostCard", () => {
  it("renders author as Link when post.author is present", () => {
    renderPostCard({ post: { author: "0xabc" } });

    const authorLink = document.querySelector(".postAuthor a") as HTMLAnchorElement | null;
    expect(authorLink).toBeTruthy();
    expect(authorLink?.getAttribute("href")).toContain("/profile/0xabc");
  });

  it("renders author label as plain text when post.author is missing", () => {
    renderPostCard({ props: { authorLabel: "Anonymous" }, post: { author: undefined } });

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Anonymous" })).toBeNull();
  });

  it("uses backgroundImage avatar when authorAvatarUrl is provided", () => {
    renderPostCard({ props: { authorAvatarUrl: "ipfs://avatar" } });

    const avatar = document.querySelector(".avatar.small") as HTMLDivElement | null;
    expect(avatar).toBeTruthy();
    expect(avatar?.style.backgroundImage).toContain("/ipfs/avatar");
  });

  it("uses fallback avatar color when authorAvatarUrl is empty", () => {
    renderPostCard({ props: { authorAvatarUrl: "   ", authorHue: 120 } });

    const avatar = document.querySelector(".avatar.small") as HTMLDivElement | null;
    expect(avatar).toBeTruthy();
    expect(avatar?.style.backgroundImage).toBe("");
    expect(avatar?.style.background).not.toBe("");
  });

  it("does not render network badge when post.chainId is missing", () => {
    renderPostCard({ post: { chainId: undefined, mintTxHash: undefined } });
    expect(document.querySelector(".networkBadge")).toBeNull();
  });

  it("renders network badge as span when no mintTxHash", () => {
    renderPostCard({ post: { chainId: "8453", mintTxHash: undefined } });

    const badge = document.querySelector(".badge.networkBadge") as HTMLSpanElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.tagName).toBe("SPAN");
    expect(badge?.textContent).toContain("BASE");
  });

  it("highlights the post network when it matches the current wallet network", () => {
    renderPostCard({ post: { chainId: "11155111", mintTxHash: undefined }, props: { chainId: "11155111" } });

    const badge = document.querySelector(".badge.networkBadge") as HTMLSpanElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.classList.contains("isCurrentNetwork")).toBe(true);
  });

  it("renders explorer badge as link, calls getExplorerTxUrl, and copies hash if no explorer URL", () => {
    const writeText = vi.fn(async () => undefined);
    (navigator as any).clipboard = { writeText };

    const getExplorerTxUrl = vi.fn(() => null);

    const { post } = renderPostCard({
      post: { chainId: "8453", mintTxHash: "0xabc123" },
      props: { getExplorerTxUrl }
    });

    expect(getExplorerTxUrl).toHaveBeenCalledWith("8453", "0xabc123");

    const badge = document.querySelector("a.badge.networkBadge") as HTMLAnchorElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute("href")).toBe("#");
    expect(badge?.getAttribute("target")).toBeNull();
    expect(badge?.getAttribute("rel")).toBeNull();

    fireEvent.click(badge as HTMLAnchorElement);
    expect(writeText).toHaveBeenCalledWith(post.mintTxHash);
  });

  it("uses props.chainId when post.chainId is missing for explorer URL lookup", () => {
    const getExplorerTxUrl = vi.fn(() => null);

    renderPostCard({
      post: { chainId: undefined, mintTxHash: "0xabc123" },
      props: { chainId: "8453", getExplorerTxUrl }
    });

    expect(getExplorerTxUrl).toHaveBeenCalledWith("8453", "0xabc123");
  });

  it("does not mark the network badge as current when post.chainId differs", () => {
    renderPostCard({
      post: { chainId: "8453", mintTxHash: "0xhash" },
      props: { chainId: "1", walletAddress: null, getExplorerTxUrl: () => null }
    });

    const badge = document.querySelector("a.badge.networkBadge") as HTMLAnchorElement | null;
    expect(badge).toBeTruthy();
    expect(badge?.className).not.toContain("isCurrentNetwork");
  });

  it("links to explorer when explorer URL is available (does not copy)", () => {
    const writeText = vi.fn(async () => undefined);
    (navigator as any).clipboard = { writeText };

    const getExplorerTxUrl = vi.fn(() => "https://explorer/tx/0xhash");

    renderPostCard({
      post: { chainId: "8453", mintTxHash: "0xhash" },
      props: { getExplorerTxUrl }
    });

    const badge = screen.getByRole("link", { name: "BASE" }) as HTMLAnchorElement;
    expect(badge.getAttribute("href")).toBe("https://explorer/tx/0xhash");
    expect(badge.getAttribute("target")).toBe("_blank");
    expect(badge.getAttribute("rel")).toBe("noreferrer");

    fireEvent.click(badge);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does not throw if clipboard is unavailable when explorer URL is unavailable", () => {
    delete (navigator as any).clipboard;

    renderPostCard({ post: { chainId: "8453", mintTxHash: "0xhash" }, props: { getExplorerTxUrl: () => null } });

    expect(() => {
      fireEvent.click(screen.getByRole("link", { name: "BASE" }));
    }).not.toThrow();
  });

  it("does not render Saved/Liked badges in the post header (context is shown by selected tab)", () => {
    renderPostCard({ post: { contextTag: "saved" } });
    expect(screen.queryByText("Saved")).toBeNull();

    renderPostCard({ post: { contextTag: "liked" } });
    expect(screen.queryByText("Liked")).toBeNull();
  });

  it("calls onStartEditPost and onBurn when edit/burn buttons are clicked", () => {
    const onStartEditPost = vi.fn();
    const onBurn = vi.fn();

    const { post } = renderPostCard({
      post: { chainId: "8453" },
      props: { isMine: true, onStartEditPost, onBurn }
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit post" }));
    expect(onStartEditPost).toHaveBeenCalledWith(post);

    fireEvent.click(screen.getByRole("button", { name: "Burn post" }));
    expect(onBurn).toHaveBeenCalledWith(post.tokenId, post.chainId);
  });

  it("calls onTogglePanel when Comment and Tip are clicked", () => {
    const onTogglePanel = vi.fn();

    renderPostCard({
      post: { chainId: "8453" },
      props: { onTogglePanel }
    });

    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(onTogglePanel).toHaveBeenCalledWith("comment");

    fireEvent.click(screen.getByRole("button", { name: "Tip" }));
    expect(onTogglePanel).toHaveBeenCalledWith("tip");
  });

  it("renders edit and burn buttons and disables them when requiresNetworkSwitch", () => {
    const { rerender } = renderPostCard({
      post: { chainId: "8453" },
      props: { isMine: true, walletAddress: "0xme" }
    });

    expect(screen.getByRole("button", { name: "Edit post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Burn post" })).toBeInTheDocument();

    // Requires switch: wallet is on 8453, post is on 9999.
    rerender(
      <MemoryRouter>
        <PostCard
          {...(renderPostCard().props as any)}
          post={{ ...basePost, chainId: "9999" }}
          chainId={"8453"}
          walletAddress={"0xme"}
          isMine={true}
        />
      </MemoryRouter>
    );

    const editBtn = screen.getByRole("button", { name: "Edit post" });
    const burnBtn = screen.getByRole("button", { name: "Burn post" });

    expect(editBtn).toBeDisabled();
    expect(burnBtn).toBeDisabled();
  });

  it("disables interactions when viewing a different network", () => {
    renderPostCard({ post: { chainId: "999999" }, props: { walletAddress: "0xme", chainId: "1" } });

    const like = screen.getByRole("button", { name: "Like" });
    expect(like).toBeDisabled();
    expect(like).toHaveAttribute("title", expect.stringContaining("Switch"));
  });

  it("renders edit mode with preview media and freeze (mine only)", () => {
    const onSetEditDraft = vi.fn();
    const onFreezePost = vi.fn();
    const onEditSelectFile = vi.fn();

    const { rerender } = renderPostCard({
      props: {
        isMine: true,
        editingTokenId: "1",
        editDraft: { ...baseDraft, body: "x", imageDataUrl: "data:image/png;base64,aaa" },
        onSetEditDraft,
        onFreezePost,
        onEditSelectFile
      }
    });

    expect(screen.getByAltText("Edit preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Freeze" }));
    expect(onFreezePost).toHaveBeenCalledWith("1", undefined);

    fireEvent.change(screen.getByPlaceholderText("Post text"), { target: { value: "new" } });
    expect(onSetEditDraft).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Image URL"), { target: { value: "ipfs://img" } });
    expect(onSetEditDraft).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: "ipfs://img", imageDataUrl: "" }));

    const fileInput = document.querySelector("input.file-input") as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [] } });
    expect(onEditSelectFile).toHaveBeenCalledWith(null);

    rerender(
      <MemoryRouter>
        <PostCard
          {...(renderPostCard().props as any)}
          editingTokenId={"1"}
          isMine={true}
          editDraft={{ ...baseDraft, body: "x", imageDataUrl: "blob:preview" }}
        />
      </MemoryRouter>
    );

    expect(document.querySelector("video.image-preview")).toBeTruthy();
  });

  it("does not render Freeze in edit mode when isMine is false", () => {
    renderPostCard({ props: { isMine: false, editingTokenId: "1", editDraft: { ...baseDraft, body: "x" } } });

    expect(screen.queryByRole("button", { name: "Freeze" })).toBeNull();
    const editBox = document.querySelector(".editBox") as HTMLElement | null;
    expect(editBox).toBeTruthy();
    expect(within(editBox as HTMLElement).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(editBox as HTMLElement).getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders body inline when there is no image or animation", () => {
    renderPostCard({ post: { image: "", animationUrl: undefined } });
    expect(document.querySelector(".post-body")).toBeTruthy();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders animationUrl as video with optional poster", () => {
    renderPostCard({ post: { image: "ipfs://poster", animationUrl: "ipfs://vid" } });

    const video = document.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    expect(video?.getAttribute("poster") ?? "").toContain("/ipfs/poster");
  });

  it("renders animationUrl video without a poster when post.image is empty", () => {
    renderPostCard({ post: { image: "", animationUrl: "ipfs://vid" } });

    const video = document.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    expect(video?.getAttribute("poster")).toBeNull();
  });

  it("falls back to ipfs.io gateway for video when the primary gateway errors", async () => {
    vi.stubEnv("VITE_IPFS_GATEWAY", "https://gateway.pinata.cloud/ipfs/");

    const { container } = renderPostCard({ post: { image: "ipfs://bafy-img", animationUrl: "ipfs://bafy-video" } });

    const video = container.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video).toBeTruthy();

    expect(video?.getAttribute("src") ?? "").not.toContain("ipfs.io/ipfs/");

    fireEvent.error(video as any);
    await waitFor(() => expect(video?.getAttribute("src") ?? "").toContain("ipfs.io/ipfs/"));
  });

  it("does not fall back for non-IPFS video URLs", () => {
    const { container } = renderPostCard({ post: { image: "", animationUrl: "https://example.com/video.mp4" } });

    const video = container.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video).toBeTruthy();

    const before = video?.getAttribute("src") ?? "";
    fireEvent.error(video as any);
    const after = video?.getAttribute("src") ?? "";

    expect(after).toBe(before);
    expect(after).not.toContain("ipfs.io/ipfs/");
  });

  it("does not refallback if the video is already on the fallback gateway", () => {
    vi.stubEnv("VITE_IPFS_GATEWAY", "https://ipfs.io/ipfs/");

    const { container } = renderPostCard({ post: { image: "ipfs://bafy-img", animationUrl: "ipfs://bafy-video" } });

    const video = container.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video).toBeTruthy();

    const before = video?.getAttribute("src") ?? "";
    fireEvent.error(video as any);
    const after = video?.getAttribute("src") ?? "";

    expect(before).toContain("ipfs.io/ipfs/");
    expect(after).toBe(before);
  });

  it("falls back to ipfs.io gateway for image when the primary gateway errors", async () => {
    vi.stubEnv("VITE_IPFS_GATEWAY", "https://gateway.pinata.cloud/ipfs/");

    const { container } = renderPostCard({ post: { image: "ipfs://bafy-img-only", animationUrl: undefined } });

    const img = container.querySelector("img.postImage") as HTMLImageElement | null;
    expect(img).toBeTruthy();

    expect(img?.getAttribute("src") ?? "").not.toContain("ipfs.io/ipfs/");

    fireEvent.error(img as any);
    await waitFor(() => expect(img?.getAttribute("src") ?? "").toContain("ipfs.io/ipfs/"));
  });

  it("does not fall back for non-IPFS image URLs", () => {
    const { container } = renderPostCard({ post: { image: "https://example.com/img.png", animationUrl: undefined } });

    const img = container.querySelector("img.postImage") as HTMLImageElement | null;
    expect(img).toBeTruthy();

    const before = img?.getAttribute("src") ?? "";
    fireEvent.error(img as any);
    const after = img?.getAttribute("src") ?? "";

    expect(after).toBe(before);
    expect(after).not.toContain("ipfs.io/ipfs/");
  });

  it("does not refallback if the image is already on the fallback gateway", () => {
    vi.stubEnv("VITE_IPFS_GATEWAY", "https://ipfs.io/ipfs/");

    const { container } = renderPostCard({ post: { image: "ipfs://bafy-img-only", animationUrl: undefined } });

    const img = container.querySelector("img.postImage") as HTMLImageElement | null;
    expect(img).toBeTruthy();

    const before = img?.getAttribute("src") ?? "";
    fireEvent.error(img as any);
    const after = img?.getAttribute("src") ?? "";

    expect(before).toContain("ipfs.io/ipfs/");
    expect(after).toBe(before);
  });

  it("does not overwrite blob animationSrc when post animationUrl changes", () => {
    vi.stubEnv("VITE_IPFS_GATEWAY", "https://gateway.pinata.cloud/ipfs/");

    const postA: Post = { ...basePost, image: "", animationUrl: "blob:video-preview" };
    const postB: Post = { ...basePost, image: "ipfs://img", animationUrl: "ipfs://bafy-video-b" };

    const { container, rerender } = renderPostCard({ post: postA });

    const video = container.querySelector("video.postImage") as HTMLVideoElement | null;
    expect(video?.getAttribute("src")).toBe("blob:video-preview");

    rerender(
      <MemoryRouter>
        <PostCard {...(renderPostCard().props as any)} post={postB} />
      </MemoryRouter>
    );

    expect(video?.getAttribute("src")).toBe("blob:video-preview");
  });

  it("does not overwrite blob imageSrc when post image changes", () => {
    vi.stubEnv("VITE_IPFS_GATEWAY", "https://gateway.pinata.cloud/ipfs/");

    const postA: Post = { ...basePost, image: "blob:image-preview", animationUrl: undefined };
    const postB: Post = { ...basePost, image: "ipfs://bafy-img-b", animationUrl: undefined };

    const { container, rerender } = renderPostCard({ post: postA });

    const img = container.querySelector("img.postImage") as HTMLImageElement | null;
    expect(img?.getAttribute("src")).toBe("blob:image-preview");

    rerender(
      <MemoryRouter>
        <PostCard {...(renderPostCard().props as any)} post={postB} />
      </MemoryRouter>
    );

    expect(img?.getAttribute("src")).toBe("blob:image-preview");
  });

  it("renders post caption when an image exists and not editing", () => {
    renderPostCard({ post: { image: "ipfs://img", animationUrl: undefined } });

    const caption = document.querySelector(".postCaption") as HTMLElement | null;
    expect(caption).toBeTruthy();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders tip/comment forms and wires handlers", () => {
    const onTipDraftChange = vi.fn();
    const onCommentDraftChange = vi.fn();
    const onTip = vi.fn();
    const onAction = vi.fn();

    const post: Post = { ...basePost, chainId: "8453", tipsWei: 1_000_000_000_000n, image: "ipfs://img" };

    renderPostCard({
      post,
      props: {
        walletAddress: "0xme",
        openPanel: "tip",
        tipDrafts: { "1": "0.01" },
        commentDrafts: { "1": "hi" },
        onTipDraftChange,
        onCommentDraftChange,
        onTip,
        onAction
      }
    });

    expect(screen.getByAltText("Post image")).toBeInTheDocument();

    const tipInput = screen.getByPlaceholderText(/Tip amount/i);
    fireEvent.change(tipInput, { target: { value: "0.02" } });
    expect(onTipDraftChange).toHaveBeenCalledWith("1", "0.02");

    const tipRow = tipInput.parentElement;
    if (!tipRow) throw new Error("Expected tip input to have a parent element");
    fireEvent.click(within(tipRow).getByRole("button", { name: "Tip" }));
    expect(onTip).toHaveBeenCalledWith("1", "8453");

    // Render comment panel.
    renderPostCard({
      post,
      props: {
        walletAddress: "0xme",
        openPanel: "comment",
        tipDrafts: { "1": "0.01" },
        commentDrafts: { "1": "hi" },
        onTipDraftChange,
        onCommentDraftChange,
        onTip,
        onAction
      }
    });

    const commentInput = screen.getByPlaceholderText(/Write a comment/i);
    fireEvent.change(commentInput, { target: { value: "ok" } });
    expect(onCommentDraftChange).toHaveBeenCalledWith("1", "ok");

    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    expect(onAction).toHaveBeenCalledWith("1", "comment", "8453");
  });

  it("defaults tip/comment draft values to empty strings", () => {
    renderPostCard({ props: { walletAddress: "0xme", openPanel: "tip" } });
    expect((screen.getByPlaceholderText(/Tip amount/i) as HTMLInputElement).value).toBe("");

    renderPostCard({ props: { walletAddress: "0xme", openPanel: "comment" } });
    expect((screen.getByPlaceholderText(/Write a comment/i) as HTMLInputElement).value).toBe("");
  });

  it("calls onAction when Like and Save are clicked", () => {
    const onAction = vi.fn();

    renderPostCard({
      post: { chainId: "8453", likes: 3, shares: 2, likedByMe: true, repostedByMe: true },
      props: { walletAddress: "0xme", onAction }
    });

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onAction).toHaveBeenCalledWith("1", "like", "8453");
    expect(onAction).toHaveBeenCalledWith("1", "share", "8453");
  });
});
