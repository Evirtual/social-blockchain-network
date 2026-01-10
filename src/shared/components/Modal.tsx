import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./icons";
import { hasDocument } from "@shared/lib/dom";

type Props = {
  open: boolean;
  title: ReactNode;
  headerLeading?: ReactNode;
  headerTrailing?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, headerLeading, headerTrailing, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    if (!hasDocument()) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (!hasDocument()) return null;

  const ariaLabel = typeof title === "string" ? title : "Modal";

  return createPortal(
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modalContent">
        <div className="modalHeader">
          <div className="modalHeaderContent">
            {headerLeading ? <div className="modalHeaderLeading">{headerLeading}</div> : null}
            <div className="modalTitle">{title}</div>
          </div>
          <div className="modalHeaderActions">
            {headerTrailing ? <div className="modalHeaderTrailing">{headerTrailing}</div> : null}
            <button className="ghost iconButton" type="button" onClick={onClose} aria-label="Close">
              <IconX size={16} />
            </button>
          </div>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>,
    document.body
  );
}
