import { Link } from "react-router-dom";
import type { PostComment } from "@types";
import { IconEdit, IconFlag, IconRepeat, IconTrash } from "@shared/components/icons";
import { ipfsToHttp } from "@features/ipfs";
import { getProfileUrl } from "@shared/lib/profile";

type Props = {
  comment: PostComment;
  label: string;
  hue: number;
  avatarUrl?: string;
  postChainId?: string | null;
  explorer: string | null;
  canEdit: boolean;
  canDelete: boolean;
  requiresNetworkSwitch: boolean;
  isBusy: boolean;
  isReportBusy: boolean;
  isDeleteBusy: boolean;
  onOpenReport: () => void;
  onOpenEdit: () => void;
  onDelete: () => Promise<void>;
};

export function CommentHeader(props: Props) {
  const avatarStyle = props.avatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(props.avatarUrl)})` }
    : { background: `hsl(${props.hue} 75% 55%)` };

  return (
    <div className="postHead">
      <div className="avatar small" style={avatarStyle} />
      <div className="postHeadMain">
        <div className="postHeadTop">
          <div className="postAuthor">
            <Link to={getProfileUrl(props.postChainId ?? null, props.comment.author)}>{props.label}</Link>
            {props.comment.edited ? <span className="badge">Edited</span> : null}
            {props.comment.deleted ? <span className="badge">Deleted</span> : null}
          </div>
          <div className="postTokenArea">
            <span className="postTokenActions">
              {props.explorer ? (
                <a
                  className="ghost iconButton commentLink"
                  href={props.explorer}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View transaction"
                  title="View transaction"
                >
                  <IconRepeat size={16} />
                </a>
              ) : null}
              <button
                className="ghost iconButton"
                type="button"
                onClick={props.onOpenReport}
                disabled={props.requiresNetworkSwitch || props.isBusy}
                aria-busy={props.isReportBusy}
                aria-label="Report comment"
                title="Report"
              >
                <IconFlag size={14} />
              </button>
              {props.canEdit ? (
                <button
                  className="ghost iconButton"
                  type="button"
                  onClick={props.onOpenEdit}
                  disabled={props.requiresNetworkSwitch || props.isBusy}
                  aria-label="Edit comment"
                  title="Edit"
                >
                  <IconEdit size={14} />
                </button>
              ) : null}
              {props.canDelete ? (
                <button
                  className="ghost iconButton danger"
                  type="button"
                  onClick={props.onDelete}
                  disabled={props.requiresNetworkSwitch || props.isBusy}
                  aria-busy={props.isDeleteBusy}
                  aria-label="Delete comment"
                  title="Delete"
                >
                  {props.isDeleteBusy ? <span className="spinner" aria-hidden="true" /> : <IconTrash size={14} />}
                </button>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
