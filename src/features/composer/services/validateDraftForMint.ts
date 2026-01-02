import type { Draft } from "@types";
import { getDraftMediaState } from "@features/post/services/draftMediaState";

export function validateDraftForMint(args: { draft: Draft; uploadedImageBlob: Blob | null }) {
  const { bodyTrimmed, imageUrlTrimmed, imageDataUrlTrimmed, hasMedia } = getDraftMediaState(
    args.draft,
    args.uploadedImageBlob
  );

  if (!bodyTrimmed && !imageUrlTrimmed && !imageDataUrlTrimmed) {
    return { ok: false as const, error: "Add text or attach media (image/video) to post." };
  }

  return {
    ok: true as const,
    bodyTrimmed,
    imageUrlTrimmed,
    imageDataUrlTrimmed,
    hasMedia
  };
}
