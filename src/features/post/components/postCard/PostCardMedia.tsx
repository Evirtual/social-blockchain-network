import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ipfsToHttp, ipfsToHttpWithGateway } from "../../../ipfs";

export type PostCardMediaProps = {
  postUrl: string;
  from: string;
  postChainId?: string | null;
  tokenId: string;

  body: string;
  image?: string;
  animationUrl?: string;

  fallbackGateway?: string;
};

export function PostCardMedia(props: PostCardMediaProps) {
  const fallbackGateway = props.fallbackGateway ?? "https://ipfs.io/ipfs/";

  const hasMedia = !!props.image || !!props.animationUrl;

  const animationPrimaryUrl = props.animationUrl ? ipfsToHttp(props.animationUrl) : "";
  const imagePrimaryUrl = props.image ? ipfsToHttp(props.image) : "";

  const [animationSrc, setAnimationSrc] = useState<string>(animationPrimaryUrl);
  const [imageSrc, setImageSrc] = useState<string>(imagePrimaryUrl);

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

  return (
    <>
      {!!props.animationUrl ? (
        <Link
          className="postImageLink"
          to={props.postUrl}
          state={{ from: props.from, chainId: props.postChainId ?? null }}
          aria-label="Open post"
        >
          <video
            className="postImage"
            src={animationSrc}
            poster={imageSrc || undefined}
            controls
            playsInline
            preload="metadata"
            onError={() => {
              if (!props.animationUrl?.startsWith("ipfs://")) return;
              if (animationSrc.startsWith(fallbackGateway)) return;
              const next = ipfsToHttpWithGateway(props.animationUrl, fallbackGateway);
              setAnimationSrc(next);
            }}
          />
        </Link>
      ) : props.image ? (
        <Link
          className="postImageLink"
          to={props.postUrl}
          state={{ from: props.from, chainId: props.postChainId ?? null }}
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

      {hasMedia ? null : <div className="post-body">{description}</div>}

      {hasMedia && !!props.body?.trim() ? <div className="postCaption">{description}</div> : null}
    </>
  );
}
