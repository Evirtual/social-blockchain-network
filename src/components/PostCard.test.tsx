import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Draft, Post } from "../types";
import { PostCard } from "./PostCard";

describe("PostCard", () => {
  it("renders author label and token link", () => {
    const post: Post = {
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

    const draft: Draft = {
      title: "",
      body: "",
      imageUrl: "",
      imageDataUrl: ""
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
          editDraft={draft}
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
});
