import { useCallback, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

export type AdminAction = "approve" | "disapprove" | "reset" | "save" | null;

export function useProfilePageHandlers(args: {
  address: string;
  navigate: NavigateFunction;
  walletActions: { disconnectWallet: () => void };
  profileActions: { saveProfile: () => void };
  social: { withdrawTips: () => Promise<void> };
  contractActions: { refreshContractState: () => Promise<void> };
  follow: { toggleFollow: (address: string) => Promise<boolean | undefined> };
  admin: {
    onAdminSetPosterAllowed: (allowed: boolean) => Promise<void>;
    onAdminReset: () => Promise<void>;
    onAdminSetProfile: (next: {
      name: string;
      bio: string;
      avatarUrl: string;
      avatarFile?: File | null;
      avatarFilename?: string;
      avatarDataUrl?: string;
    }) => Promise<void>;
  };
}) {
  const [isFollowSubmitting, setIsFollowSubmitting] = useState(false);
  const [adminActionInFlight, setAdminActionInFlight] = useState<AdminAction>(null);

  const onDisconnectWallet = useCallback(() => {
    args.walletActions.disconnectWallet();
    args.navigate("/", { replace: true });
  }, [args]);

  const onSaveProfile = useCallback(() => {
    void args.profileActions.saveProfile();
  }, [args]);

  const onWithdrawTips = useCallback(async () => {
    await args.social.withdrawTips();
    try {
      await args.contractActions.refreshContractState();
    } catch {
      // ignore
    }
  }, [args]);

  const onToggleFollow = useCallback(async () => {
    if (isFollowSubmitting) return;
    setIsFollowSubmitting(true);
    try {
      await args.follow.toggleFollow(args.address);
    } finally {
      setIsFollowSubmitting(false);
    }
  }, [args, isFollowSubmitting]);

  const onAdminSetPosterAllowed = useCallback(
    async (allowed: boolean) => {
      if (adminActionInFlight) return;
      setAdminActionInFlight(allowed ? "approve" : "disapprove");
      try {
        await args.admin.onAdminSetPosterAllowed(allowed);
      } finally {
        setAdminActionInFlight(null);
      }
    },
    [args, adminActionInFlight]
  );

  const onAdminReset = useCallback(async () => {
    if (adminActionInFlight) return;
    setAdminActionInFlight("reset");
    try {
      await args.admin.onAdminReset();
    } finally {
      setAdminActionInFlight(null);
    }
  }, [args, adminActionInFlight]);

  const onAdminSetProfile = useCallback(
    async (next: {
      name: string;
      bio: string;
      avatarUrl: string;
      avatarFile?: File | null;
      avatarFilename?: string;
      avatarDataUrl?: string;
    }) => {
      if (adminActionInFlight) return;
      setAdminActionInFlight("save");
      try {
        await args.admin.onAdminSetProfile(next);
      } finally {
        setAdminActionInFlight(null);
      }
    },
    [args, adminActionInFlight]
  );

  return {
    adminActionInFlight,
    isFollowSubmitting,
    onDisconnectWallet,
    onSaveProfile,
    onWithdrawTips,
    onToggleFollow,
    onAdminSetPosterAllowed,
    onAdminReset,
    onAdminSetProfile
  };
}
