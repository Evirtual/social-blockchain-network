import { getAvatarStyle } from "@shared/lib/avatar";

export function buildProfileHeaderCardState(args: {
  canAdminEdit: boolean;
  wasPosterDisapprovedEver?: boolean;
  isPosterAllowed?: boolean;
  adminActionInFlight?: "approve" | "disapprove" | "reset" | "save" | null;
  canFollow: boolean;
  isFollowing: boolean | undefined;
  isFollowSubmitting?: boolean;
  avatarHue: number;
  avatarUrl?: string;
}) {
  const isPosterAllowedKnown = typeof args.isPosterAllowed === "boolean";
  const isAllowed = args.isPosterAllowed === true;
  const isAdminLoading = args.canAdminEdit && !isPosterAllowedKnown;
  const isAdminSubmitting = !!args.adminActionInFlight;
  const isApproveBusy = args.adminActionInFlight === "approve";
  const isDisapproveBusy = args.adminActionInFlight === "disapprove";
  const isResetBusy = args.adminActionInFlight === "reset";
  const isFollowLoading = args.canFollow && typeof args.isFollowing !== "boolean";
  const isFollowSubmitting = !!args.isFollowSubmitting;
  const isFollowBusy = isFollowLoading || isFollowSubmitting;
  const avatarStyle = getAvatarStyle({ avatarUrl: args.avatarUrl, hue: args.avatarHue });

  return {
    isAllowed,
    isAdminLoading,
    isAdminSubmitting,
    isApproveBusy,
    isDisapproveBusy,
    isResetBusy,
    isFollowLoading,
    isFollowSubmitting,
    isFollowBusy,
    avatarStyle
  };
}
