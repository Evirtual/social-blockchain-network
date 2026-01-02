export function buildFeedTopics0(readContract: any): string[] {
  const getEventTopic0 = (filter: any): string | null => {
    const topic0 = filter?.topics?.[0] ?? null;
    return typeof topic0 === "string" && topic0.length > 0 ? topic0 : null;
  };

  const topics0 = Array.from(
    new Set(
      [
        getEventTopic0(readContract.filters.PostMinted()),
        getEventTopic0(readContract.filters.PostUpdated()),
        getEventTopic0(readContract.filters.PostUpdatedByAdmin()),
        getEventTopic0(readContract.filters.PostBurned()),
        getEventTopic0(readContract.filters.PostBurnedByAdmin()),
        getEventTopic0(readContract.filters.PostLiked()),
        getEventTopic0(readContract.filters.PostUnliked()),
        getEventTopic0(readContract.filters.CommentAdded()),
        getEventTopic0(readContract.filters.CommentDeleted()),
        getEventTopic0(readContract.filters.PostSaved()),
        getEventTopic0(readContract.filters.PostUnsaved()),
        getEventTopic0(readContract.filters.PostTipped())
      ].filter((x): x is string => !!x)
    )
  );

  return topics0;
}
