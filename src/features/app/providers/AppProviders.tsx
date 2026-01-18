import type { ReactNode } from "react";
import { ContractProvider } from "@features/contract";
import { FeedProvider } from "@features/feed";
import { FollowProvider } from "@features/follow";
import { ProfileProvider } from "@features/profile";
import { ComposerProvider } from "@features/composer";
import { SocialActionsProvider } from "@features/social";
import { StatusProvider } from "@features/status";
import { ThemeProvider } from "@features/theme";
import { TxNotificationsProvider } from "@features/tx";
import { WalletProvider } from "@features/wallet";
import { VideoTrimProvider } from "@features/videoTrim";
import { ImageCropProvider } from "@features/imageCrop";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TxNotificationsProvider>
      <StatusProvider>
        <ThemeProvider>
          <WalletProvider>
            <ContractProvider>
              <FeedProvider>
                <ImageCropProvider>
                  <ProfileProvider>
                    <FollowProvider>
                      <VideoTrimProvider>
                        <ComposerProvider>
                          <SocialActionsProvider>{children}</SocialActionsProvider>
                        </ComposerProvider>
                      </VideoTrimProvider>
                    </FollowProvider>
                  </ProfileProvider>
                </ImageCropProvider>
              </FeedProvider>
            </ContractProvider>
          </WalletProvider>
        </ThemeProvider>
      </StatusProvider>
    </TxNotificationsProvider>
  );
}
