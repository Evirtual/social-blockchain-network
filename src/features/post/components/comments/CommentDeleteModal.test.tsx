import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentDeleteModal } from "./CommentDeleteModal";

function setup(overrides: Partial<Parameters<typeof CommentDeleteModal>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <CommentDeleteModal
      open
      commentText="A comment that is about to be deleted"
      onConfirm={onConfirm}
      onClose={onClose}
      isDeleting={false}
      requiresNetworkSwitch={false}
      {...overrides}
    />
  );

  return { onConfirm, onClose };
}

describe("CommentDeleteModal", () => {
  it("says the action cannot be undone", () => {
    setup();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("shows the comment so it is clear which one is going", () => {
    setup();
    expect(screen.getByText("A comment that is about to be deleted")).toBeInTheDocument();
  });

  it("omits the preview for a comment with no text", () => {
    setup({ commentText: "   " });
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
  });

  it("deletes only when the dialog's own button is used", async () => {
    // The whole point: reaching this dialog must not itself delete anything.
    const { onConfirm } = setup();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /delete comment/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes without deleting when cancelled", async () => {
    const { onConfirm, onClose } = setup();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe("while the delete is in flight", () => {
    it("does not allow a second delete", () => {
      setup({ isDeleting: true });
      expect(screen.getByRole("button", { name: /delete comment/i })).toBeDisabled();
    });

    it("does not allow cancelling a transaction already sent", () => {
      // Closing here would suggest the delete had been called off when it has not.
      setup({ isDeleting: true });
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });
  });

  it("blocks deleting a comment on another network", () => {
    setup({ requiresNetworkSwitch: true });
    expect(screen.getByRole("button", { name: /delete comment/i })).toBeDisabled();
  });

  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
  });
});
