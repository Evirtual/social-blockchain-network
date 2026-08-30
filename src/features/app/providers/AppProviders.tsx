import type { ReactNode } from "react";
import { ContractProvider } from "@features/contract/providers/ContractProvider";
import { FeedProvider } from "@features/feed/providers/FeedProvider";
import { FollowProvider } from "@features/follow/providers/FollowProvider";
import { ProfileProvider } from "@features/profile/providers/ProfileProvider";
import { ComposerProvider } from "@features/composer/providers/ComposerProvider";
import { SocialActionsProvider } from "@features/social/providers/SocialActionsProvider";
import { StatusProvider } from "@features/status/providers/StatusProvider";
import { ThemeProvider } from "@features/theme/providers/ThemeProvider";
import { TxNotificationsProvider } from "@features/tx/providers/TxNotificationsProvider";
import { WalletProvider } from "@features/wallet/providers/WalletProvider";
import { VideoTrimProvider } from "@features/videoTrim/providers/VideoTrimProvider";
import { ImageCropProvider } from "@features/imageCrop/providers/ImageCropProvider";

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
