import { Navigate, useLocation, useParams } from "react-router-dom";
import { PostPageContainer } from "@features/post";

export function PostRoute() {
  const params = useParams();
  const location = useLocation();
  const tokenId = params.tokenId as string | undefined;
  const stateChainId = (location.state as { chainId?: string | null } | null)?.chainId ?? null;
  const paramChainId = (params.chainId as string | undefined) ?? null;
  const postChainId = paramChainId ?? stateChainId;

  // If we navigated internally with chainId in state, prefer the canonical URL.
  if (tokenId && !paramChainId && stateChainId) {
    return <Navigate to={`/post/${stateChainId}/${tokenId}`} replace state={location.state} />;
  }

  if (!tokenId) {
    return (
      <main className="home">
        <section className="card">
          <div className="cardTitle">Post</div>
          <div className="muted">Missing token id.</div>
        </section>
      </main>
    );
  }
  return <PostPageContainer tokenId={tokenId} postChainId={postChainId} />;
}
