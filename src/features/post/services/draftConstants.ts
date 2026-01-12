import type { Draft } from "@types";

export const EMPTY_DRAFT: Draft = { title: "", body: "", imageUrl: "", imageDataUrl: "" };

export const MAX_IMAGE_DATA_URL_CHARS = 90_000;
// When IPFS pinning is enabled, the image does not need to fit inside an on-chain tokenURI.
// Allow a much larger preview data URL so pinned image quality isn't overly degraded.
export const MAX_IMAGE_DATA_URL_CHARS_IPFS = 750_000;
export const MAX_ONCHAIN_TOKEN_URI_CHARS = 140_000;

export const IMAGE_COMPRESSION_CANDIDATES: Array<{ q: number; dim: number }> = [
  { q: 0.78, dim: 640 },
  { q: 0.7, dim: 512 },
  { q: 0.62, dim: 512 },
  { q: 0.55, dim: 420 }
];

export const IMAGE_COMPRESSION_CANDIDATES_IPFS: Array<{ q: number; dim: number }> = [
  { q: 0.9, dim: 1600 },
  { q: 0.88, dim: 1440 },
  { q: 0.86, dim: 1280 },
  { q: 0.84, dim: 1152 },
  { q: 0.82, dim: 1024 },
  { q: 0.8, dim: 960 }
];
