import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChainLogo } from "./ChainLogos";

describe("ChainLogo", () => {
  it("renders Ethereum logo and respects aria-label", () => {
    const { container } = render(<ChainLogo chainId={1} aria-label="Ethereum" size={18} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("18");
    expect(svg?.getAttribute("height")).toBe("18");
    expect(svg?.getAttribute("aria-label")).toBe("Ethereum");
    // When aria-label is provided we do not force aria-hidden.
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
  });

  it("renders Base logo", () => {
    const { container } = render(<ChainLogo chainId={8453} aria-label="Base" />);
    expect(screen.getByLabelText("Base")).toBeInTheDocument();
    // Base mark includes circles.
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(0);
  });

  it("renders BSC logo", () => {
    const { container } = render(<ChainLogo chainId={56} aria-label="BSC" />);
    expect(screen.getByLabelText("BSC")).toBeInTheDocument();
    // BSC mark includes multiple circles.
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(0);
  });

  it("renders default logo and is aria-hidden when no aria-label", () => {
    const { container } = render(<ChainLogo chainId={999999} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
