export const POSTER_ALLOWED_CHANGED_EVENT = "sbnet:posterAllowedChanged";

export type PosterAllowedChangedDetail = {
  address: string;
  allowed: boolean;
  disapprovedEver?: boolean;
};

export function emitPosterAllowedChanged(detail: PosterAllowedChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PosterAllowedChangedDetail>(POSTER_ALLOWED_CHANGED_EVENT, { detail }));
}

export function onPosterAllowedChanged(handler: (detail: PosterAllowedChangedDetail) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<PosterAllowedChangedDetail>).detail);
  };
  window.addEventListener(POSTER_ALLOWED_CHANGED_EVENT, listener);
  return () => window.removeEventListener(POSTER_ALLOWED_CHANGED_EVENT, listener);
}

