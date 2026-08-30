import type { ReactNode } from "react";
import { ContractProvider } from "../../contract/providers/ContractProvider";
import { FeedProvider } from "../../feed/providers/FeedProvider";
import { FollowProvider } from "../../follow/providers/FollowProvider";
import { ProfileProvider } from "../../profile/providers/ProfileProvider";
import { ComposerProvider } from "../../composer/providers/ComposerProvider";
import { SocialActionsProvider } from "../../social/providers/SocialActionsProvider";
import { StatusProvider } from "../../status/providers/StatusProvider";
import { ThemeProvider } from "../../theme/providers/ThemeProvider";
import { TxNotificationsProvider } from "../../tx/providers/TxNotificationsProvider";
import { WalletProvider } from "../../wallet/providers/WalletProvider";
import { VideoTrimProvider } from "../../videoTrim/providers/VideoTrimProvider";
import { ImageCropProvider } from "../../imageCrop/providers/ImageCropProvider";

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
