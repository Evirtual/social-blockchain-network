type Props = {
  showHeaderStats: boolean;
  showPostsStat: boolean;
  isLoadingMyPostsCount?: boolean;
  myPostsCount?: number;
  followerCount?: number;
  followers: string[];
  following: string[];
  isLoadingFollowers?: boolean;
  isLoadingFollowing?: boolean;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
};

export function ProfileHeaderStats(props: Props) {
  if (!props.showHeaderStats) return null;

  const pillCountSkeleton = (widthRem: number) => (
    <span className="skeletonLine" style={{ width: `${widthRem}rem`, height: "0.85rem" }} aria-hidden="true" />
  );

  return (
    <div className="cardHeaderStats" aria-label="Profile stats">
      {props.isLoadingMyPostsCount ? (
        <span className="cardHeaderStat buttonWithSpinner" aria-label="Loading post count" aria-busy="true">
          {pillCountSkeleton(1.9)} posts
        </span>
      ) : typeof props.myPostsCount === "number" ? (
        <span className="cardHeaderStat">{props.myPostsCount} posts</span>
      ) : null}
      {props.showPostsStat ? <span className="cardHeaderStatSep" aria-hidden="true">|</span> : null}
      <button type="button" className="cardHeaderStatLink buttonWithSpinner" onClick={props.onOpenFollowers}>
        {props.isLoadingFollowers ? (
          <>
            {pillCountSkeleton(2.1)} followers
          </>
        ) : (
          `${typeof props.followerCount === "number" ? props.followerCount : props.followers.length} followers`
        )}
      </button>
      <span className="cardHeaderStatSep" aria-hidden="true">|</span>
      <button type="button" className="cardHeaderStatLink buttonWithSpinner" onClick={props.onOpenFollowing}>
        {props.isLoadingFollowing ? (
          <>
            {pillCountSkeleton(2.1)} following
          </>
        ) : (
          `${props.following.length} following`
        )}
      </button>
    </div>
  );
}
