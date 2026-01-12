import type { Draft } from "@types";
import {
  makeUploadNonce,
  ipfsToHttp,
  makePinataBaseName,
  makeUniqueFilename,
  makeUniquePinName,
  pinataPinFile,
  pinataPinJson,
  type PinataNameContext
} from "./ipfs";

export async function buildIpfsTokenUri(input: {
  draft: Draft;
  imageBlob: Blob | null;
  imageFilename: string;
  mediaTypeHint?: "image" | "video";
  pinNameContext?: Omit<Extract<PinataNameContext, { kind: "post" }>, "purpose" | "title">;
}): Promise<{ tokenUri: string; imageRef: string; animationRef: string }> {
  const looksLikeVideoUrl = (url: string) => {
    const u = url.toLowerCase();
    return u.startsWith("ipfs://")
      ? u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".m4v")
      : u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
  };

  let imageRef = "";
  let animationRef = "";

  const baseMedia = makePinataBaseName({
    kind: "post",
    purpose: "media",
    title: input.draft.title,
    ...(input.pinNameContext ?? {})
  });

  const baseMeta = makePinataBaseName({
    kind: "post",
    purpose: "metadata",
    title: input.draft.title,
    ...(input.pinNameContext ?? {})
  });

  if (input.imageBlob) {
    const uniqueName = makeUniquePinName(baseMedia);
    const uniqueFilename = makeUniqueFilename(baseMedia, input.imageBlob.type);
    const fileRes = await pinataPinFile(input.imageBlob, uniqueFilename, uniqueName, { wrapWithDirectory: true });
    const mediaRef = `ipfs://${fileRes.IpfsHash}/${uniqueFilename}`;
    const isVideo = input.imageBlob.type?.startsWith("video/") ?? false;
    if (isVideo) animationRef = mediaRef;
    else imageRef = mediaRef;
  } else if (input.draft.imageUrl) {
    const url = input.draft.imageUrl.trim();
    // Browsers can't fetch ipfs:// URLs directly. If the user pasted an IPFS URI,
    // treat it as an already-hosted ref and avoid re-pinning.
    if (url.startsWith("ipfs://")) {
      // If the URL doesn't include a file extension (common for ipfs://<CID>),
      // we can't reliably infer whether it is a video. Allow the caller to hint.
      const hinted = input.mediaTypeHint;
      if (hinted === "video") animationRef = url;
      else if (hinted === "image") imageRef = url;
      else if (looksLikeVideoUrl(url)) animationRef = url;
      else imageRef = url;
    } else {
      try {
        const res = await fetch(ipfsToHttp(url));
        if (res.ok) {
          const blob = await res.blob();
          const uniqueName = makeUniquePinName(baseMedia);
          const uniqueFilename = makeUniqueFilename(baseMedia, blob.type);
          const fileRes = await pinataPinFile(blob, uniqueFilename, uniqueName, { wrapWithDirectory: true });
          const mediaRef = `ipfs://${fileRes.IpfsHash}/${uniqueFilename}`;
          if (blob.type.startsWith("video/")) animationRef = mediaRef;
          else if (blob.type.startsWith("image/")) imageRef = mediaRef;
          else if (input.mediaTypeHint === "video") animationRef = mediaRef;
          else imageRef = mediaRef;
        } else {
          if (looksLikeVideoUrl(url)) animationRef = url;
          else imageRef = url;
        }
      } catch {
        if (looksLikeVideoUrl(url)) animationRef = url;
        else imageRef = url;
      }
    }
  }

  const metadata: {
    name?: string;
    description?: string;
    image?: string;
    animation_url?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
    sbnet_upload_nonce?: string;
  } = {
    name: input.draft.title,
    description: input.draft.body,
    attributes: [{ trait_type: "Origin", value: "Social Blockchain Network" }],
    // Ensures a new CID (and Pinata entry) even if content is otherwise identical.
    sbnet_upload_nonce: makeUploadNonce()
  };
  if (imageRef) metadata.image = imageRef;
  if (animationRef) {
    metadata.animation_url = animationRef;
    if (!metadata.image) metadata.image = "";
  }

  const metaRes = await pinataPinJson(
    metadata,
    makeUniquePinName(baseMeta)
  );
  return {
    tokenUri: `ipfs://${metaRes.IpfsHash}`,
    imageRef,
    animationRef
  };
}
