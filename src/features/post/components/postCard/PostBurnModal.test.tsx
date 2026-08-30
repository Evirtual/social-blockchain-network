import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostBurnModal } from "./PostBurnModal";

function setup(overrides: Partial<Parameters<typeof PostBurnModal>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <PostBurnModal
      open
      avatarStyle={{}}
      postBody="A post that is about to be destroyed"
      onConfirm={onConfirm}
      onClose={onClose}
      isBurning={false}
      requiresNetworkSwitch={false}
      {...overrides}
    />
  );

  return { onConfirm, onClose };
}

describe("PostBurnModal", () => {
  it("says the action cannot be undone", () => {
    setup();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("shows the post so it is clear which one is going", () => {
    setup();
    expect(screen.getByText("A post that is about to be destroyed")).toBeInTheDocument();
  });

  it("omits the preview for a post with no text", () => {
    setup({ postBody: "   " });
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
  });

  it("burns only when the dialog's own button is used", async () => {
    // The whole point: reaching this dialog must not itself destroy anything.
    const { onConfirm } = setup();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /burn post/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes without burning when cancelled", async () => {
    const { onConfirm, onClose } = setup();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe("while the burn is in flight", () => {
    it("does not allow a second burn", () => {
      setup({ isBurning: true });
      expect(screen.getByRole("button", { name: /burn post/i })).toBeDisabled();
    });

    it("does not allow cancelling a transaction already sent", () => {
      // Closing here would suggest the burn had been called off when it has not.
      setup({ isBurning: true });
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });
  });

  it("blocks burning a post on another network", () => {
    setup({ requiresNetworkSwitch: true });
    expect(screen.getByRole("button", { name: /burn post/i })).toBeDisabled();
  });

  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
  });
});
