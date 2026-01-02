import { Link } from "react-router-dom";
import type { Post } from "@types";
import { PostCardMedia } from "./PostCardMedia";

type Props = {
  post: Post;
  postUrl: string;
  postLinkState: { from: string; chainId: string | null };
  postChainId: string | null;
  tokenId: string;
  from: string;
  hasMedia: boolean;
};

export function PostCardBody(props: Props) {
  return (
    <>
      {!props.hasMedia && !!props.post.body?.trim() ? (
        <div className="post-body">
          <Link className="postBodyLink" to={props.postUrl} state={props.postLinkState} aria-label="Open post">
            <div className="postText">
              <p>{props.post.body}</p>
            </div>
          </Link>
        </div>
      ) : null}

      {props.hasMedia ? (
        <PostCardMedia
          postUrl={props.postUrl}
          from={props.from}
          postChainId={props.postChainId}
          tokenId={props.tokenId}
          body={props.post.body}
          image={props.post.image}
          animationUrl={props.post.animationUrl}
          showBody={false}
        />
      ) : null}

      {props.hasMedia && !!props.post.body?.trim() ? (
        <div className="postCaption">
          <div className="postText">
            <p>{props.post.body}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
