import type { Post } from "@types";
import type { PostPageViewModel } from "../types";

export function buildPostPageViewModel(args: {
  tokenId: string;
  postChainId: string | null;
  post: Post | null;
  isPostLoading: boolean;
  comments: PostPageViewModel["comments"];
  isLoadingComments: boolean;
  commentsReadOnly?: boolean;
  disableCommentAuthorProfileLookup?: boolean;
  posts: PostPageViewModel["posts"];
  isOwner: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: PostPageViewModel["authorIdentity"];
  postActions: PostPageViewModel["postActions"];
}): PostPageViewModel {
  return {
    isOwner: args.isOwner,
    tokenId: args.tokenId,
    postChainId: args.postChainId,
    post: args.post,
    isLoadingPost: args.isPostLoading && !args.post,
    comments: args.comments,
    isLoadingComments: args.isLoadingComments,
    commentsReadOnly: args.commentsReadOnly,
    disableCommentAuthorProfileLookup: args.disableCommentAuthorProfileLookup,
    posts: args.posts,
    chainId: args.chainId,
    walletAddress: args.walletAddress,
    authorIdentity: args.authorIdentity,
    postActions: args.postActions,
  };
}
