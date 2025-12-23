import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} title="Hello" onClose={() => undefined}>
        <div>Body</div>
      </Modal>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders into a portal and closes via Escape/overlay/button", () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <Modal open={true} title="Hello" onClose={onClose}>
        <div>Body</div>
      </Modal>
    );

    const dialog = screen.getByRole("dialog", { name: "Hello" });
    expect(dialog).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(3);

    // ensure cleanup restores overflow
    rerender(
      <Modal open={false} title="Hello" onClose={onClose}>
        <div>Body</div>
      </Modal>
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("renders nothing when hasDocument returns false", () => {
    // We need to mock the imported helper module (not a function binding).
    // Use a dynamic import so the mock is applied.
    return (async () => {
      vi.resetModules();
      vi.doMock("../lib/dom", () => ({ hasDocument: () => false }));

      const { Modal: ModalNoDom } = await import("./Modal");

      render(
        <ModalNoDom open={true} title="Hello" onClose={() => undefined}>
          <div>Body</div>
        </ModalNoDom>
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      vi.doUnmock("../lib/dom");
    })();
  });
});
