import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePanelById } from "./usePanelById";

describe("usePanelById", () => {
  it("gets/sets/toggles/closes per id", () => {
    function Harness() {
      const { getPanel, setPanel, togglePanel, closePanel } = usePanelById<"a" | "b">();

      return (
        <div>
          <div data-testid="p1">{getPanel("one") ?? "null"}</div>
          <div data-testid="p2">{getPanel("two") ?? "null"}</div>

          <button type="button" onClick={() => setPanel("one", "a")}>set-one-a</button>
          <button type="button" onClick={() => togglePanel("two", "b")}>toggle-two-b</button>
          <button type="button" onClick={() => togglePanel("two", "b")}>toggle-two-b-again</button>
          <button type="button" onClick={() => closePanel("one")}>close-one</button>
        </div>
      );
    }

    render(<Harness />);

    expect(screen.getByTestId("p1").textContent).toBe("null");
    expect(screen.getByTestId("p2").textContent).toBe("null");

    fireEvent.click(screen.getByText("set-one-a"));
    expect(screen.getByTestId("p1").textContent).toBe("a");

    fireEvent.click(screen.getByText("toggle-two-b"));
    expect(screen.getByTestId("p2").textContent).toBe("b");

    fireEvent.click(screen.getByText("toggle-two-b-again"));
    expect(screen.getByTestId("p2").textContent).toBe("null");

    fireEvent.click(screen.getByText("close-one"));
    expect(screen.getByTestId("p1").textContent).toBe("null");
  });
});
