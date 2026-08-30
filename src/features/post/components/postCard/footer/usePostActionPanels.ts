import type { TipOutcome } from "@features/social/services/postActions/tipOutcome";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePostComments } from "../../../../feed/hooks/usePostComments";
import type { PostPanel } from "../postPanel";
import { getNativeSymbol } from "@shared/lib/chain";

type Params = {
  tokenId: string;
  postChainId: string | null;
  chainId: string | null;
  openPanel: PostPanel | null;
  onTogglePanel: (panel: PostPanel) => void;
  onTip: (
    tokenId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<TipOutcome>;
  defaultSupportBps?: number | null;
};

export function usePostActionPanels(params: Params) {
  const {
    tokenId,
    postChainId,
    chainId,
    openPanel,
    onTogglePanel,
    onTip,
    defaultSupportBps,
  } = params;

  const nativeSymbol = useMemo(
    () => getNativeSymbol(postChainId ?? chainId),
    [postChainId, chainId]
  );

  const { comments, isLoadingComments } = usePostComments({
    tokenId,
    postChainId,
    active: openPanel === "comment"
  });

  const [tipDraft, setTipDraft] = useState<string>("");
  const [supportBpsDraft, setSupportBpsDraft] = useState<number | null>(defaultSupportBps ?? null);
  const [saveSupportPreference, setSaveSupportPreference] = useState<boolean>(false);
  const [inFlight, setInFlight] = useState<null | "like" | "save" | "tip">(null);
  const [tipError, setTipError] = useState("");

  useEffect(() => {
    setTipDraft("");
    setSupportBpsDraft(defaultSupportBps ?? null);
    setSaveSupportPreference(false);
    setInFlight(null);
    setTipError("");
  }, [tokenId, defaultSupportBps]);

  const onSubmitTip = useCallback(async () => {
    if (inFlight) return;
    setInFlight("tip");
    setTipError("");
    try {
      const result = await onTip(tokenId, tipDraft, postChainId, supportBpsDraft, saveSupportPreference);
      if (result.ok) {
        setTipDraft("");
        onTogglePanel("tip");
        return;
      }

      // A rejected tip writes its reason to the shared status, which is only
      // rendered in the sidebar - absent on the feed and at mobile widths. Show
      // it in the dialog the user is actually looking at.
      setTipError(result.error || "Tip failed.");
    } finally {
      setInFlight(null);
    }
  }, [inFlight, onTip, tokenId, tipDraft, postChainId, supportBpsDraft, saveSupportPreference, onTogglePanel]);

  const onCloseComments = useCallback(() => {
    onTogglePanel("comment");
  }, [onTogglePanel]);

  const onCloseTip = useCallback(() => {
    setTipError("");
    onTogglePanel("tip");
  }, [onTogglePanel]);

  return {
    tipError,
    comments,
    isLoadingComments,
    nativeSymbol,
    tipDraft,
    setTipDraft,
    supportBpsDraft,
    setSupportBpsDraft,
    saveSupportPreference,
    setSaveSupportPreference,
    inFlight,
    setInFlight,
    onSubmitTip,
    onCloseComments,
    onCloseTip
  };
}
