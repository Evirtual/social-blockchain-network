import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IconBookmark, IconCoin, IconMessage, IconRepeat } from "./icons";

describe("icons", () => {
  it("renders svg with sizing, fill, and aria-hidden defaults", () => {
    const { container } = render(
      <div>
        <IconBookmark data-testid="bookmark" size={24} filled />
        <IconMessage data-testid="message" />
        <IconRepeat data-testid="repeat" />
      </div>
    );

    const bookmark = screen.getByTestId("bookmark");
    expect(bookmark.tagName.toLowerCase()).toBe("svg");
    expect(bookmark).toHaveAttribute("width", "24");
    expect(bookmark).toHaveAttribute("height", "24");
    expect(bookmark).toHaveAttribute("fill", "currentColor");
    expect(bookmark).toHaveAttribute("aria-hidden", "true");

    const message = screen.getByTestId("message");
    expect(message).toHaveAttribute("fill", "none");
    expect(message).toHaveAttribute("aria-hidden", "true");

    const repeat = screen.getByTestId("repeat");
    expect(repeat.tagName.toLowerCase()).toBe("svg");
    expect(repeat).toHaveAttribute("aria-hidden", "true");

    // Sanity: we actually rendered multiple svg nodes.
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("does not set aria-hidden when aria-label is provided", () => {
    render(<IconCoin aria-label="Coin" />);
    const icon = screen.getByLabelText("Coin");
    expect(icon).not.toHaveAttribute("aria-hidden");
  });
});
