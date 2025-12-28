import type { ReactNode } from "react";
import { ComposerProvider } from "./ComposerContext";
import { FeedProvider } from "./FeedContext";
import { FollowProvider } from "./FollowContext";
import { ProfileProvider } from "./ProfileContext";
import { SocialActionsProvider } from "./SocialActionsContext";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <FeedProvider>
      <ProfileProvider>
        <FollowProvider>
          <ComposerProvider>
            <SocialActionsProvider>
              {children}
            </SocialActionsProvider>
          </ComposerProvider>
        </FollowProvider>
      </ProfileProvider>
    </FeedProvider>
  );
}
