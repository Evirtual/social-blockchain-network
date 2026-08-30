import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./icons";
import { hasDocument } from "@shared/lib/dom";

/**
 * How deeply this modal is nested inside other modals. A dialog opened from
 * inside another one sees its parent's depth and adds to it.
 */
const ModalDepthContext = createContext(0);

/** Depths of every currently open modal, so the deepest can be identified. */
const openDepths = new Set<number>();

type Props = {
  open: boolean;
  title: ReactNode;
  headerLeading?: ReactNode;
  headerTrailing?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, headerLeading, headerTrailing, onClose, children }: Props) {
  const depth = useContext(ModalDepthContext) + 1;

  useEffect(() => {
    if (!open) return;
    if (!hasDocument()) return;

    // Every open modal listens on `document`, so without this an Escape press
    // reached all of them at once: opening a confirmation from inside another
    // dialog and pressing Escape closed both, dropping the reader back to the
    // page rather than to the dialog they came from.
    //
    // Which dialog is on top is decided by nesting depth, not by DOM or mount
    // order. Portals append in the order modals happen to open, and React runs
    // a child's effects before its parent's, so both of those orderings vary
    // with timing. Depth is a fact about the tree and does not.
    openDepths.add(depth);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (depth !== Math.max(...openDepths)) return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      openDepths.delete(depth);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, depth]);

  if (!open) return null;
  if (!hasDocument()) return null;

  const ariaLabel = typeof title === "string" ? title : "Modal";

  return createPortal(
    <div
      className={depth > 1 ? "modalOverlay isStacked" : "modalOverlay"}
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
        <div className="modalBody">
          <ModalDepthContext.Provider value={depth}>{children}</ModalDepthContext.Provider>
        </div>
      </div>
    </div>,
    document.body
  );
}
