import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ipfsToHttp, ipfsToHttpWithGateway } from "@features/ipfs";

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
};

export function PostCardMedia(props: PostCardMediaProps) {
  const fallbackGateway = props.fallbackGateway ?? "https://ipfs.io/ipfs/";
  const showBody = props.showBody ?? true;

  const hasMedia = useMemo(() => !!props.image || !!props.animationUrl, [props.image, props.animationUrl]);

  const animationPrimaryUrl = useMemo(
    () => (props.animationUrl ? ipfsToHttp(props.animationUrl) : ""),
    [props.animationUrl]
  );
  const imagePrimaryUrl = useMemo(() => (props.image ? ipfsToHttp(props.image) : ""), [props.image]);

  const postLinkState = useMemo(
    () => ({ from: props.from, chainId: props.postChainId ?? null }),
    [props.from, props.postChainId]
  );

  const [animationSrc, setAnimationSrc] = useState<string>(animationPrimaryUrl);
  const [imageSrc, setImageSrc] = useState<string>(imagePrimaryUrl);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Keep state in sync if the post changes.
  // Use effects so user-driven state (like IPFS gateway fallback) isn't overwritten.
  useEffect(() => {
    setAnimationSrc((prev) => (prev.startsWith("blob:") ? prev : animationPrimaryUrl));
  }, [animationPrimaryUrl]);

  useEffect(() => {
    setImageSrc((prev) => (prev.startsWith("blob:") ? prev : imagePrimaryUrl));
  }, [imagePrimaryUrl]);

  const description = (
    <>
      <div className="postText">
        <p>{props.body}</p>
      </div>
    </>
  );

  const handleVideoLoaded = () => {
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
            preload="auto"
            ref={videoRef}
            onLoadedMetadata={handleVideoLoaded}
            onLoadedData={handleVideoLoaded}
            onError={() => {
              if (!props.animationUrl?.startsWith("ipfs://")) return;
              if (animationSrc.startsWith(fallbackGateway)) return;
              const next = ipfsToHttpWithGateway(props.animationUrl, fallbackGateway);
              setAnimationSrc(next);
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
