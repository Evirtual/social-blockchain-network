import { useEffect, useMemo, useState } from "react";
import { CommentsCard, PostFeedPanel } from "../components";
import type { PostPageViewModel } from "../types";
import { useTopbarCenter } from "@features/app/hooks/useTopbarCenter";
import { FeedTopbarControls } from "@features/feed/components/FeedTopbarControls";
import { getSupportedNetworks } from "@features/feed/services/supportedNetworks";

export function PostPage(props: PostPageViewModel) {
  const supportedNetworks = useMemo(() => getSupportedNetworks(), []);
  const initialChainId = props.postChainId ?? props.chainId;
  const [selectedNetworkChainIds, setSelectedNetworkChainIds] = useState<string[]>(
    initialChainId ? [String(initialChainId)] : []
  );

  useEffect(() => {
    if (!initialChainId) return;
    setSelectedNetworkChainIds([String(initialChainId)]);
  }, [initialChainId]);

  const topbarCenter = useMemo(
    () => (
      <FeedTopbarControls
        showSearch={false}
        searchQuery=""
        onSearchQueryChange={() => {}}
        onSearchSubmit={() => {}}
        walletAddress={props.walletAddress}
        chainId={props.chainId}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    ),
    [props.walletAddress, props.chainId, selectedNetworkChainIds, supportedNetworks]
  );

  useTopbarCenter(topbarCenter);

  return (
    <main className="home">
      <div className="postSplit">
        <div className="postLeft">
          <PostFeedPanel
            title="Post"
            post={props.post}
            isLoadingPost={props.isLoadingPost}
            isOwner={props.isOwner}
            chainId={props.chainId}
            walletAddress={props.walletAddress}
            authorIdentity={props.authorIdentity}
            postActions={props.postActions}
          />
        </div>

        <div className="postRight">
          <CommentsCard
            tokenId={props.tokenId}
            postChainId={props.postChainId}
            chainId={props.chainId}
            walletAddress={props.walletAddress}
            canModerateComments={props.isOwner}
            forceReadOnly={!!props.commentsReadOnly}
            allowCommenting={!props.commentsReadOnly}
            disableAuthorProfileLookup={!!props.disableCommentAuthorProfileLookup}
            comments={props.comments}
            isLoadingComments={props.isLoadingComments}
            postActions={props.postActions}
          />
        </div>
      </div>
    </main>
  );
}
