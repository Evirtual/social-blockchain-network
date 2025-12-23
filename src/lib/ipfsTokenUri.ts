import type { Draft } from "../types";
import { pinataPinFile, pinataPinJson } from "../ipfs";

export async function buildIpfsTokenUri(input: {
  draft: Draft;
  imageBlob: Blob | null;
  imageFilename: string;
}): Promise<{ tokenUri: string; imageRef: string; animationRef: string }> {
  const looksLikeVideoUrl = (url: string) => {
    const u = url.toLowerCase();
    return u.startsWith("ipfs://")
      ? u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".m4v")
      : u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m4v");
  };

  let imageRef = "";
  let animationRef = "";

  if (input.imageBlob) {
    const fileRes = await pinataPinFile(input.imageBlob, input.imageFilename || "post-media");
    const mediaRef = `ipfs://${fileRes.IpfsHash}`;
    const isVideo = (input.imageBlob as any)?.type?.startsWith?.("video/") ?? false;
    if (isVideo) animationRef = mediaRef;
    else imageRef = mediaRef;
  } else if (input.draft.imageUrl) {
    const url = input.draft.imageUrl.trim();
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const fileRes = await pinataPinFile(blob, "post-media");
        const mediaRef = `ipfs://${fileRes.IpfsHash}`;
        if (blob.type.startsWith("video/")) animationRef = mediaRef;
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

  const metadata: any = {
    name: input.draft.title,
    description: input.draft.body,
    attributes: [{ trait_type: "Origin", value: "Social Blockchain Network" }]
  };
  if (imageRef) metadata.image = imageRef;
  if (animationRef) {
    metadata.animation_url = animationRef;
    if (!metadata.image) metadata.image = "";
  }

  const metaRes = await pinataPinJson(metadata);
  return {
    tokenUri: `ipfs://${metaRes.IpfsHash}`,
    imageRef,
    animationRef
  };
}
