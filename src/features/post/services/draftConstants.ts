import type { Draft } from "@types";

export const EMPTY_DRAFT: Draft = { title: "", body: "", imageUrl: "", imageDataUrl: "" };

export const MAX_IMAGE_DATA_URL_CHARS = 90_000;
export const MAX_ONCHAIN_TOKEN_URI_CHARS = 140_000;

export const IMAGE_COMPRESSION_CANDIDATES: Array<{ q: number; dim: number }> = [
  { q: 0.78, dim: 640 },
  { q: 0.7, dim: 512 },
  { q: 0.62, dim: 512 },
  { q: 0.55, dim: 420 }
];
