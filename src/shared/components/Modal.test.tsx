import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Only dialog" onClose={onClose}>
        body
      </Modal>
    );

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Only dialog" onClose={onClose}>
        body
      </Modal>
    );

    await userEvent.keyboard("{Enter}");
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("when one dialog is opened from inside another", () => {
    function setupStacked() {
      const onCloseOuter = vi.fn();
      const onCloseInner = vi.fn();

      render(
        <Modal open title="Comments" onClose={onCloseOuter}>
          <Modal open title="Delete this comment?" onClose={onCloseInner}>
            confirm
          </Modal>
        </Modal>
      );

      return { onCloseOuter, onCloseInner };
    }

    it("closes only the top one, leaving the reader where they came from", async () => {
      // Both modals listen on document, so without a stack a single Escape
      // reached both and dropped the reader all the way back to the page.
      const { onCloseOuter, onCloseInner } = setupStacked();

      await userEvent.keyboard("{Escape}");

      expect(onCloseInner).toHaveBeenCalledTimes(1);
      expect(onCloseOuter).not.toHaveBeenCalled();
    });

    it("closes the one underneath once the top one is gone", async () => {
      const onCloseOuter = vi.fn();

      const { rerender } = render(
        <Modal open title="Comments" onClose={onCloseOuter}>
          <Modal open title="Delete this comment?" onClose={() => {}}>
            confirm
          </Modal>
        </Modal>
      );

      rerender(
        <Modal open title="Comments" onClose={onCloseOuter}>
          <Modal open={false} title="Delete this comment?" onClose={() => {}}>
            confirm
          </Modal>
        </Modal>
      );

      await userEvent.keyboard("{Escape}");
      expect(onCloseOuter).toHaveBeenCalledTimes(1);
    });

    it("keeps the one underneath mounted, so it keeps its state", () => {
      // Nothing is unmounted while a confirmation is up, so a half-typed
      // comment and the scroll position survive opening and cancelling it.
      setupStacked();

      expect(screen.getByText("confirm")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Comments" })).toBeInTheDocument();
    });
  });
});
