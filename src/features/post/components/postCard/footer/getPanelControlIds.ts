export function getCommentControlId(postChainId: string | null | undefined, tokenId: string) {
  return `comment-${postChainId ?? ""}-${tokenId}`;
}

export function getTipControlId(postChainId: string | null | undefined, tokenId: string) {
  return `tip-${postChainId ?? ""}-${tokenId}`;
}
