import { useEffect, useMemo } from "react";
import { commentKey } from "@features/post/services";
import { useFeedActions } from "../providers/useFeedActions";
import { useFeedState } from "../providers/useFeedState";

export function usePostComments(params: {
  tokenId: string;
  postChainId: string | null;
  active: boolean;
}) {
  const { tokenId, postChainId, active } = params;
  const feedState = useFeedState();
  const feedActions = useFeedActions();

  const key = useMemo(() => commentKey(postChainId, tokenId), [postChainId, tokenId]);
  const comments = feedState.postComments[key] ?? [];
  const isLoadingComments = !!feedState.isLoadingPostComments[key];

  useEffect(() => {
    if (!active) return;
    void feedActions.loadCommentsForPost(tokenId, postChainId);
  }, [active, feedActions, tokenId, postChainId]);

  return { comments, isLoadingComments };
}
