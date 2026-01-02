import type { Post } from "@types";
import type { PostPageViewModel } from "../types";

export function buildPostPageViewModel(args: {
  tokenId: string;
  postChainId: string | null;
  post: Post | null;
  isPostLoading: boolean;
  comments: PostPageViewModel["comments"];
  isLoadingComments: boolean;
  posts: PostPageViewModel["posts"];
  isOwner: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: PostPageViewModel["authorIdentity"];
  postActions: PostPageViewModel["postActions"];
  shortAddress: PostPageViewModel["shortAddress"];
  stableHueFromSeed: PostPageViewModel["stableHueFromSeed"];
  getNativeSymbol: PostPageViewModel["getNativeSymbol"];
  getExplorerTxUrl: PostPageViewModel["getExplorerTxUrl"];
}): PostPageViewModel {
  return {
    isOwner: args.isOwner,
    tokenId: args.tokenId,
    postChainId: args.postChainId,
    post: args.post,
    isLoadingPost: args.isPostLoading && !args.post,
    comments: args.comments,
    isLoadingComments: args.isLoadingComments,
    posts: args.posts,
    chainId: args.chainId,
    walletAddress: args.walletAddress,
    authorIdentity: args.authorIdentity,
    postActions: args.postActions,
    shortAddress: args.shortAddress,
    stableHueFromSeed: args.stableHueFromSeed,
    getNativeSymbol: args.getNativeSymbol,
    getExplorerTxUrl: args.getExplorerTxUrl
  };
}
