// @vitest-environment node
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ProfileCard } from "./Sidebar";

vi.mock("../contexts/AppContext", () => {
  return {
    useApp: () => ({
      loadProfile: async () => undefined,
      profilesByAddress: {},
      stableHueFromSeed: () => 0
    })
  };
});

describe("Sidebar (node)", () => {
  it("can server-render when window is undefined", () => {
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProfileCard, {
          walletAddress: null,
          displayName: "Anon",
          profileBio: "",
          profileAvatarUrl: "",
          myPostsCount: undefined,
          followerCount: undefined,
          followers: null,
          following: null,
          isLoadingFollowers: false,
          isLoadingFollowing: false,
          onDisconnectWallet: () => undefined,
          isEditingProfile: false,
          profileDraftName: "",
          profileDraftBio: "",
          profileDraftAvatarUrl: "",
          profileDraftAvatarDataUrl: "",
          isProfileAvatarLoading: false,
          onProfileDraftNameChange: () => undefined,
          onProfileDraftBioChange: () => undefined,
          onProfileDraftAvatarUrlChange: () => undefined,
          onSelectProfileAvatarFile: async () => undefined,
          onClearProfileAvatar: () => undefined,
          onStartEditProfile: () => undefined,
          onCancelEditProfile: () => undefined,
          onSaveProfile: () => undefined,
          selfAvatarHue: 0,
          shortAddress: (a: string) => a
        })
      )
    );

    expect(html).toContain("Profile");
  });
});
