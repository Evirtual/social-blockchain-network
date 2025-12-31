import type { Draft } from "@types";

export function getDraftMediaState(draft: Draft, uploadedBlob?: Blob | null) {
  const bodyTrimmed = (draft.body || "").trim();
  const imageUrlTrimmed = (draft.imageUrl || "").trim();
  const imageDataUrlTrimmed = (draft.imageDataUrl || "").trim();
  const hasMedia = Boolean(uploadedBlob || imageUrlTrimmed || imageDataUrlTrimmed);

  return { bodyTrimmed, imageUrlTrimmed, imageDataUrlTrimmed, hasMedia };
}
