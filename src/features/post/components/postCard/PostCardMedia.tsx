import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ipfsToHttp, ipfsToHttpCandidates, ipfsToHttpWithGateway } from "@features/ipfs";

export type PostCardMediaProps = {
  postUrl: string;
  from: string;
  postChainId?: string | null;
  tokenId: string;

  body: string;
  image?: string;
  animationUrl?: string;

  showBody?: boolean;

  fallbackGateway?: string;
  videoPreload?: "none" | "metadata" | "auto";
};

export function PostCardMedia(props: PostCardMediaProps) {
  const fallbackGateway = props.fallbackGateway ?? "https://ipfs.io/ipfs/";
  const showBody = props.showBody ?? true;
  const videoPreload = props.videoPreload ?? "metadata";

  const hasMedia = useMemo(() => !!props.image || !!props.animationUrl, [props.image, props.animationUrl]);

  const animationCandidates = useMemo(
    () => {
      if (!props.animationUrl) return [];
      const base = ipfsToHttpCandidates(props.animationUrl);
      if (!props.animationUrl.startsWith("ipfs://")) return base;
      const fallback = ipfsToHttpWithGateway(props.animationUrl, fallbackGateway);
      return base.includes(fallback) ? base : [...base, fallback];
    },
    [props.animationUrl, fallbackGateway]
  );
  const imagePrimaryUrl = useMemo(() => (props.image ? ipfsToHttp(props.image) : ""), [props.image]);

  const postLinkState = useMemo(
    () => ({ from: props.from, chainId: props.postChainId ?? null }),
    [props.from, props.postChainId]
  );

  const [animationCandidateIndex, setAnimationCandidateIndex] = useState(0);
  const [imageSrc, setImageSrc] = useState<string>(imagePrimaryUrl);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoGatewayTimeoutIdRef = useRef<number | null>(null);

  const clearVideoGatewayTimeout = useCallback(() => {
    if (!videoGatewayTimeoutIdRef.current) return;
    window.clearTimeout(videoGatewayTimeoutIdRef.current);
    videoGatewayTimeoutIdRef.current = null;
  }, []);

  const animationSrc = animationCandidates[animationCandidateIndex] ?? animationCandidates[0] ?? "";

  const tryNextVideoGateway = useCallback(() => {
    if (!props.animationUrl?.startsWith("ipfs://")) return;
    if (animationCandidates.length <= 1) return;
    setAnimationCandidateIndex((prev) => (prev + 1 < animationCandidates.length ? prev + 1 : prev));
  }, [animationCandidates.length, props.animationUrl]);

  // Keep state in sync if the post changes.
  // Use effects so user-driven state (like IPFS gateway fallback) isn't overwritten.
  useEffect(() => {
    setAnimationCandidateIndex(0);
    clearVideoGatewayTimeout();
  }, [props.animationUrl, clearVideoGatewayTimeout]);

  useEffect(() => {
    setImageSrc((prev) => (prev.startsWith("blob:") ? prev : imagePrimaryUrl));
  }, [imagePrimaryUrl]);

  useEffect(() => {
    clearVideoGatewayTimeout();
    if (!props.animationUrl?.startsWith("ipfs://")) return;
    if (animationCandidates.length <= 1) return;
    if (!animationSrc) return;

    // Some gateways (or mobile networks) can hang for a while before firing `error`.
    // If we haven't even loaded metadata after a short grace period, try the next gateway.
    videoGatewayTimeoutIdRef.current = window.setTimeout(() => {
      videoGatewayTimeoutIdRef.current = null;
      const node = videoRef.current;
      if (!node) return;
      if (node.readyState >= 1) return; // HAVE_METADATA
      tryNextVideoGateway();
    }, 4500);

    return () => clearVideoGatewayTimeout();
  }, [
    animationSrc,
    animationCandidates.length,
    props.animationUrl,
    clearVideoGatewayTimeout,
    tryNextVideoGateway
  ]);

  const description = (
    <>
      <div className="postText">
        <p>{props.body}</p>
      </div>
    </>
  );

  const handleVideoLoaded = () => {
    clearVideoGatewayTimeout();
    if (imageSrc) return;
    const node = videoRef.current;
    if (!node) return;
    try {
      if (node.currentTime === 0) node.currentTime = 0.01;
    } catch {
      // Ignore seek errors; the poster may still render once the browser has data.
    }
  };

  return (
    <>
      {!!props.animationUrl ? (
        <div className="postImageLink">
          <video
            className="postImage"
            src={animationSrc}
            poster={imageSrc || undefined}
            controls
            playsInline
            preload={videoPreload}
            ref={videoRef}
            onLoadedMetadata={handleVideoLoaded}
            onLoadedData={handleVideoLoaded}
            onCanPlay={clearVideoGatewayTimeout}
            onPlaying={clearVideoGatewayTimeout}
            onError={() => {
              clearVideoGatewayTimeout();
              tryNextVideoGateway();
            }}
          />
        </div>
      ) : props.image ? (
        <Link
          className="postImageLink"
          to={props.postUrl}
          state={postLinkState}
          aria-label="Open post"
        >
          <img
            className="postImage"
            src={imageSrc}
            alt="Post image"
            loading="lazy"
            onError={() => {
              if (!props.image?.startsWith("ipfs://")) return;
              if (imageSrc.startsWith(fallbackGateway)) return;
              const next = ipfsToHttpWithGateway(props.image, fallbackGateway);
              setImageSrc(next);
            }}
          />
        </Link>
      ) : null}

      {showBody && !hasMedia ? <div className="post-body">{description}</div> : null}

      {showBody && hasMedia && !!props.body?.trim() ? <div className="postCaption">{description}</div> : null}
    </>
  );
}
