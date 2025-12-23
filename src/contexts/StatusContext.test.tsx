import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StatusProvider, useStatus } from "./StatusContext";

function Consumer() {
  const { status, setStatus, clearStatus } = useStatus();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <button onClick={() => setStatus("Hello")}>set</button>
      <button onClick={() => clearStatus()}>clear</button>
    </div>
  );
}

describe("StatusContext", () => {
  it("provides default status and can update/clear", () => {
    render(
      <StatusProvider>
        <Consumer />
      </StatusProvider>
    );

    expect(screen.getByTestId("status")).toHaveTextContent("Wallet disconnected");
    fireEvent.click(screen.getByText("set"));
    expect(screen.getByTestId("status")).toHaveTextContent("Hello");
    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("status")).toHaveTextContent("");
  });

  it("throws when used outside provider", () => {
    expect(() => render(<Consumer />)).toThrow(/useStatus must be used/);
  });
});
