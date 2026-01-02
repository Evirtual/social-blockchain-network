import type { ReactNode } from "react";

type Props = {
  title?: string;
  pillText?: string;
  postsCount: number;
  headerInlineAction?: ReactNode;
  headerAction?: ReactNode;
  headerActionPlacement?: "right" | "inline";
  hideHeader?: boolean;
};

export function FeedHeader(props: Props) {
  if (props.hideHeader) return null;

  const actionPlacement = props.headerActionPlacement ?? "right";
  const inlineAction = props.headerInlineAction ?? (actionPlacement === "inline" ? props.headerAction : null);
  const rightAction = actionPlacement === "inline" ? null : props.headerAction;

  return (
    <div className="feed-header">
      <div className="feedHeaderLeft">
        <h2 className="feedHeaderTitle">{props.title ?? "Chain Feed"}</h2>
        {inlineAction ? <div className="feedHeaderInlineAction">{inlineAction}</div> : null}
      </div>

      {rightAction ? <div className="feedHeaderAction">{rightAction}</div> : null}
      {props.pillText === "" ? null : (
        <span className="pill feedHeaderPill">{props.pillText ?? `${props.postsCount} minted posts`}</span>
      )}
    </div>
  );
}
