import type { Contract, DeferredTopicFilter, TopicFilter } from "ethers";

type FilterWithTopics = { topics?: ReadonlyArray<string | string[] | null> };
type FilterLike = DeferredTopicFilter | TopicFilter | FilterWithTopics;

async function resolveTopics(filter: FilterLike): Promise<ReadonlyArray<string | string[] | null>> {
  if (Array.isArray(filter)) return filter;
  if ("getTopicFilter" in filter) {
    const resolved = await filter.getTopicFilter();
    return resolved ?? [];
  }
  const topics = (filter as { topics?: ReadonlyArray<string | string[] | null> }).topics;
  return topics ?? [];
}

export async function buildFeedTopics0(readContract: Contract): Promise<string[]> {
  const getEventTopic0 = async (filter: FilterLike): Promise<string | null> => {
    const topics = await resolveTopics(filter);
    const topic0 = topics[0] ?? null;
    return typeof topic0 === "string" && topic0.length > 0 ? topic0 : null;
  };

  const topics0 = Array.from(
    new Set(
      (await Promise.all([
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
      ])).filter((x): x is string => !!x)
    )
  );

  return topics0;
}
