import { useCallback, useEffect, useMemo, useState } from "react";

import { usePostComments } from "@features/feed";
import type { PostPanel } from "../../PostCard";

type Params = {
  tokenId: string;
  postChainId: string | null;
  chainId: string | null;
  openPanel: PostPanel | null;
  onTogglePanel: (panel: PostPanel) => void;
  onTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  getNativeSymbol: (chainId: string | null) => string;
};

export function usePostActionPanels(params: Params) {
  const { tokenId, postChainId, chainId, openPanel, onTogglePanel, onTip, getNativeSymbol } = params;

  const nativeSymbol = useMemo(
    () => getNativeSymbol(postChainId ?? chainId),
    [getNativeSymbol, postChainId, chainId]
  );

  const { comments, isLoadingComments } = usePostComments({
    tokenId,
    postChainId,
    active: openPanel === "comment"
  });

  const [tipDraft, setTipDraft] = useState<string>("");
  const [inFlight, setInFlight] = useState<null | "like" | "save" | "tip">(null);

  useEffect(() => {
    setTipDraft("");
    setInFlight(null);
  }, [tokenId]);

  const onSubmitTip = useCallback(async () => {
    if (inFlight) return;
    setInFlight("tip");
    try {
      const ok = await onTip(tokenId, tipDraft, postChainId);
      if (ok) {
        setTipDraft("");
        onTogglePanel("tip");
      }
    } finally {
      setInFlight(null);
    }
  }, [inFlight, onTip, tokenId, tipDraft, postChainId, onTogglePanel]);

  const onCloseComments = useCallback(() => {
    onTogglePanel("comment");
  }, [onTogglePanel]);

  const onCloseTip = useCallback(() => {
    onTogglePanel("tip");
  }, [onTogglePanel]);

  return {
    comments,
    isLoadingComments,
    nativeSymbol,
    tipDraft,
    setTipDraft,
    inFlight,
    setInFlight,
    onSubmitTip,
    onCloseComments,
    onCloseTip
  };
}
