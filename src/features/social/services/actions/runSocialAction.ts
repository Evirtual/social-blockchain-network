import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { fail, ok, type ActionResult } from "@shared/lib/result";

export async function runSocialAction<T>(params: {
  walletAddress: string | null;
  setStatus: (value: string) => void;
  ensureMatchingNetwork?: (postChainId?: string | null) => boolean;
  postChainId?: string | null;
  action: () => Promise<T>;
}): Promise<ActionResult<T>> {
  if (!params.walletAddress) {
    requestConnectNudge();
    const message = "Connect your wallet first.";
    params.setStatus(message);
    return fail(message);
  }
  if (params.ensureMatchingNetwork && !params.ensureMatchingNetwork(params.postChainId)) {
    return fail();
  }

  try {
    const value = await params.action();
    return ok(value);
  } catch (error) {
    const message = setStatusFromError(params.setStatus, error as ErrorInput);
    return fail(message);
  }
}
