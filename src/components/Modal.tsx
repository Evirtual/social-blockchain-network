import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modalContent">
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="ghost iconButton" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>,
    document.body
  );
}
