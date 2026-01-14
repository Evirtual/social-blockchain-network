import type { CSSProperties, ReactNode } from "react";

type Props = {
  avatarStyle: CSSProperties;
  name: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function ProfileHeader({ avatarStyle, name, meta, actions, className }: Props) {
  const classNames = ["profileHeader", className].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      <div className="avatar medium" style={avatarStyle} />
      <div className="profileMain">
        <div className="profileName">{name}</div>
        {meta != null ? <div className="profileMeta">{meta}</div> : null}
      </div>

      {actions != null ? <div className="profileActions">{actions}</div> : null}
    </div>
  );
}
