import { getErrorMessage, type ErrorInput } from "@shared/lib/errors";
import { requestConnectNudge } from "@shared/lib/connectNudge";

export async function runSocialAction<T>(params: {
  walletAddress: string | null;
  setStatus: (value: string) => void;
  ensureMatchingNetwork?: (postChainId?: string | null) => boolean;
  postChainId?: string | null;
  action: () => Promise<T>;
}): Promise<T | null> {
  if (!params.walletAddress) {
    requestConnectNudge();
    params.setStatus("Connect your wallet first.");
    return null;
  }
  if (params.ensureMatchingNetwork && !params.ensureMatchingNetwork(params.postChainId)) {
    return null;
  }

  try {
    return await params.action();
  } catch (error) {
    params.setStatus(getErrorMessage(error as ErrorInput));
    return null;
  }
}
