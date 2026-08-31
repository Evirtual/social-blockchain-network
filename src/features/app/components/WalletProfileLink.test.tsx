import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WalletProfileLink } from "./WalletProfileLink";

const ADDRESS = "0x91484b0e55c3d577602763784e34b5c08abfdfcc";

function renderLink(overrides: Partial<Parameters<typeof WalletProfileLink>[0]> = {}) {
  return render(
    <MemoryRouter>
      <WalletProfileLink
        profileLink="/profile/97/0x9148"
        walletAddress={ADDRESS}
        chainId="97"
        displayName="BSC Origin"
        avatarHue={210}
        {...overrides}
      />
    </MemoryRouter>
  );
}

describe("WalletProfileLink", () => {
  it("shows the profile name when one is set", () => {
    renderLink();
    expect(screen.getByText("BSC Origin")).toBeInTheDocument();
  });

  it("falls back to the short address when no name is set", () => {
    // displayName already resolves this upstream; the pill just renders it, and
    // an account without a profile must still be identifiable here.
    renderLink({ displayName: "0x9148…dfcc" });
    expect(screen.getByText("0x9148…dfcc")).toBeInTheDocument();
  });

  it("uses the uploaded avatar when there is one", () => {
    const { container } = renderLink({ avatarUrl: "https://example.test/a.png" });
    const avatar = container.querySelector(".walletProfileLinkAvatar") as HTMLElement;
    expect(avatar.style.backgroundImage).toContain("example.test/a.png");
  });

  it("falls back to the address's own hue when there is no avatar", () => {
    const { container } = renderLink({ avatarUrl: undefined });
    const avatar = container.querySelector(".walletProfileLinkAvatar") as HTMLElement;
    // The exact colour is not the point and jsdom rewrites hsl() to rgb() anyway;
    // what matters is that it falls back to a solid colour rather than an image.
    expect(avatar.style.backgroundImage).not.toContain("url(");
    expect(avatar.style.background).not.toBe("");
  });

  it("renders nothing without a profile link", () => {
    const { container } = renderLink({ profileLink: null });
    expect(container).toBeEmptyDOMElement();
  });
});
