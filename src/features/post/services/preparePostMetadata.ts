import type { Draft } from "@types";
import { createMetadataUri } from "@features/metadata";
import { buildIpfsTokenUri } from "@features/ipfs";
import { MAX_ONCHAIN_TOKEN_URI_CHARS } from "./draftConstants";
import type { PinataNameContext } from "@features/ipfs";

type PreparePostMetadataArgs = {
  draft: Draft;
  hasMedia: boolean;
  ipfsConfigured: boolean;
  uploadedImageBlob: Blob | null;
  uploadedImageFilename: string;
  mediaTypeHint?: "image" | "video";
  maxOnchainChars?: number;
  pinNameContext?: Omit<Extract<PinataNameContext, { kind: "post" }>, "purpose" | "title">;
};

type PreparePostMetadataResult =
  | {
      ok: true;
      willUseIpfs: boolean;
      tokenUri: string;
      imageRef: string;
      animationRef: string;
    }
  | {
      ok: false;
      willUseIpfs: boolean;
      reason: "onchain-too-large";
    };

export async function preparePostMetadata(args: PreparePostMetadataArgs): Promise<PreparePostMetadataResult> {
  const willUseIpfs = args.ipfsConfigured && args.hasMedia;

  if (willUseIpfs) {
    const built = await buildIpfsTokenUri({
      draft: args.draft,
      imageBlob: args.uploadedImageBlob,
      imageFilename: args.uploadedImageFilename,
      mediaTypeHint: args.mediaTypeHint,
      pinNameContext: args.pinNameContext
    });

    return {
      ok: true,
      willUseIpfs,
      tokenUri: built.tokenUri,
      imageRef: built.imageRef,
      animationRef: built.animationRef
    };
  }

  const tokenUri = createMetadataUri(args.draft);
  const maxOnchainChars = args.maxOnchainChars ?? MAX_ONCHAIN_TOKEN_URI_CHARS;
  if (tokenUri.length > maxOnchainChars) {
    return {
      ok: false,
      willUseIpfs,
      reason: "onchain-too-large"
    };
  }

  return {
    ok: true,
    willUseIpfs,
    tokenUri,
    imageRef: args.draft.imageDataUrl || args.draft.imageUrl,
    animationRef: ""
  };
}
