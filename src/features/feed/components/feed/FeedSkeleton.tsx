import { memo } from "react";

export const FeedSkeleton = memo(function FeedSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article key={`skeleton-${index}`} className="post postSkeleton" aria-hidden="true">
          <div className="postHead">
            <div className="avatar small skeleton" />
            <div className="postHeadMain">
              <div className="postHeadTop">
                <div className="skeletonLine" style={{ width: "40%" }} />
                <div className="skeletonLine" style={{ width: "22%" }} />
              </div>
            </div>
          </div>

          <div className="post-body">
            <div className="skeletonLine" style={{ width: "92%" }} />
            <div className="skeletonLine" style={{ width: "84%" }} />
            <div className="skeletonLine" style={{ width: "66%" }} />
          </div>
        </article>
      ))}
    </>
  );
});
