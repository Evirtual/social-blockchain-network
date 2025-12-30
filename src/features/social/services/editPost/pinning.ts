import { extractIpfsCid } from "@features/ipfs";

export function collectPinnedCidsFromBuilt(args: {
  tokenUri: string;
  imageRef?: string;
  animationRef?: string;
}) {
  const set = new Set<string>();

  const metaCid = extractIpfsCid(args.tokenUri);
  if (metaCid) set.add(metaCid);

  const imageCid = args.imageRef ? extractIpfsCid(args.imageRef) : null;
  if (imageCid) set.add(imageCid);

  const animCid = args.animationRef ? extractIpfsCid(args.animationRef) : null;
  if (animCid) set.add(animCid);

  return set;
}
