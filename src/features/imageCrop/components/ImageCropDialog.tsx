import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@shared/components/Modal";
import { ipfsToHttp } from "@features/ipfs";
import { useObjectUrl } from "@shared/hooks/useObjectUrl";
import { clamp } from "@shared/lib/math";
import type { ImageCropRect, ImageCropSession } from "../types";

type Props = {
  session: ImageCropSession;
  onClose: (reason: "cancel" | "completed") => void;
};

type DragMode = "move" | "nw" | "ne" | "sw" | "se";
type DragState = {
  mode: DragMode;
  startCrop: ImageCropRect;
  startX: number;
  startY: number;
};

const MIN_SPAN = 0.05;

const sanitizeCrop = (crop: ImageCropRect): ImageCropRect => {
  const left = clamp(crop.left, 0, 1);
  const right = clamp(crop.right, 0, 1);
  const top = clamp(crop.top, 0, 1);
  const bottom = clamp(crop.bottom, 0, 1);
  const l = Math.min(left, right);
  const r = Math.max(left, right);
  const t = Math.min(top, bottom);
  const b = Math.max(top, bottom);
  return { left: l, right: r, top: t, bottom: b };
};

const enforceMinSpan = (crop: ImageCropRect): ImageCropRect => {
  const width = crop.right - crop.left;
  const height = crop.bottom - crop.top;
  let next = crop;

  if (width < MIN_SPAN) {
    const mid = (crop.left + crop.right) / 2;
    next = { ...next, left: clamp(mid - MIN_SPAN / 2, 0, 1), right: clamp(mid + MIN_SPAN / 2, 0, 1) };
  }
  if (height < MIN_SPAN) {
    const mid = (crop.top + crop.bottom) / 2;
    next = { ...next, top: clamp(mid - MIN_SPAN / 2, 0, 1), bottom: clamp(mid + MIN_SPAN / 2, 0, 1) };
  }

  const maxLeft = 1 - (next.right - next.left);
  const maxTop = 1 - (next.bottom - next.top);
  const left = clamp(next.left, 0, maxLeft);
  const top = clamp(next.top, 0, maxTop);
  return { ...next, left, top, right: left + (next.right - next.left), bottom: top + (next.bottom - next.top) };
};

export function ImageCropDialog({ session, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const previewUrl = useObjectUrl(session.originalFile);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [crop, setCrop] = useState<ImageCropRect>({ left: 0, top: 0, right: 1, bottom: 1 });
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    setIsReady(false);
    setErrorMessage(null);
    setCrop(sanitizeCrop(session.existingCrop ?? { left: 0, top: 0, right: 1, bottom: 1 }));
    dragRef.current = null;
  }, [session.existingCrop, session.originalFile]);

  useEffect(() => {
    if (previewUrl) setErrorMessage(null);
  }, [previewUrl]);

  const existingUrl = session.existingImageUrl ? ipfsToHttp(session.existingImageUrl) : "";

  const toNormalizedPoint = useCallback((event: PointerEvent | React.PointerEvent) => {
    const el = overlayRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const point = toNormalizedPoint(event);
      if (!point) return;

      if (state.mode === "move") {
        const dx = point.x - state.startX;
        const dy = point.y - state.startY;
        const width = state.startCrop.right - state.startCrop.left;
        const height = state.startCrop.bottom - state.startCrop.top;
        const left = clamp(state.startCrop.left + dx, 0, 1 - width);
        const top = clamp(state.startCrop.top + dy, 0, 1 - height);
        setCrop({ left, top, right: left + width, bottom: top + height });
        return;
      }

      const nextRaw = (() => {
        switch (state.mode) {
          case "nw":
            return { ...state.startCrop, left: point.x, top: point.y };
          case "ne":
            return { ...state.startCrop, right: point.x, top: point.y };
          case "sw":
            return { ...state.startCrop, left: point.x, bottom: point.y };
          case "se":
            return { ...state.startCrop, right: point.x, bottom: point.y };
        }
      })();

      setCrop(enforceMinSpan(sanitizeCrop(nextRaw)));
    },
    [toNormalizedPoint]
  );

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDrag);
    window.removeEventListener("pointercancel", stopDrag);
  }, [handlePointerMove]);

  useEffect(() => stopDrag, [stopDrag]);

  const beginDrag = useCallback(
    (event: React.PointerEvent, mode: DragMode) => {
      if (!isReady) return;
      const point = toNormalizedPoint(event);
      if (!point) return;
      setErrorMessage(null);
      dragRef.current = { mode, startCrop: crop, startX: point.x, startY: point.y };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDrag);
      window.addEventListener("pointercancel", stopDrag);
      event.preventDefault();
    },
    [crop, handlePointerMove, isReady, stopDrag, toNormalizedPoint]
  );

  const handleCancel = useCallback(() => {
    onClose("cancel");
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    try {
      session.onConfirm({ crop: enforceMinSpan(sanitizeCrop(crop)) });
      onClose("completed");
    } catch (e) {
      console.error("[image-crop] confirm error", e);
      setErrorMessage("Failed to apply crop.");
    }
  }, [crop, onClose, session]);

  const cropStyles = useMemo(() => {
    const leftPct = `${crop.left * 100}%`;
    const topPct = `${crop.top * 100}%`;
    const rightPct = `${crop.right * 100}%`;
    const bottomPct = `${crop.bottom * 100}%`;
    const widthPct = `${Math.max(crop.right - crop.left, 0) * 100}%`;
    const heightPct = `${Math.max(crop.bottom - crop.top, 0) * 100}%`;
    const shadeTopHeight = `${Math.max(crop.top, 0) * 100}%`;
    const shadeBottomTop = `${Math.max(crop.bottom, 0) * 100}%`;
    const shadeBottomHeight = `${Math.max(1 - crop.bottom, 0) * 100}%`;
    const shadeSideTop = topPct;
    const shadeSideHeight = heightPct;
    const shadeLeftWidth = `${Math.max(crop.left, 0) * 100}%`;
    const shadeRightLeft = rightPct;
    const shadeRightWidth = `${Math.max(1 - crop.right, 0) * 100}%`;
    return {
      leftPct,
      topPct,
      rightPct,
      bottomPct,
      widthPct,
      heightPct,
      shadeTopHeight,
      shadeBottomTop,
      shadeBottomHeight,
      shadeSideTop,
      shadeSideHeight,
      shadeLeftWidth,
      shadeRightLeft,
      shadeRightWidth
    };
  }, [crop]);

  return (
    <Modal title="Crop image" open onClose={handleCancel}>
      <div className="imageCropDialog">
        {existingUrl ? (
          <div className="imageCropDialogExisting">
            Cropping from <a href={existingUrl} target="_blank" rel="noreferrer">{existingUrl}</a>
          </div>
        ) : null}
        <div className="imageCropDialogPreview">
          <div className="imageCropDialogImageStage">
            <div className="imageCropDialogImageBox">
              {previewUrl ? (
                <>
                  <img
                    key={previewUrl}
                    className="imageCropDialogImage"
                    src={previewUrl}
                    alt="Crop preview"
                    draggable={false}
                    onLoad={() => setIsReady(true)}
                    onError={() => setErrorMessage("Failed to load image preview.")}
                  />
                  <div ref={overlayRef} className="imageCropDialogOverlay" aria-hidden="true">
                    <div className="imageCropDialogShade imageCropDialogShadeTop" style={{ height: cropStyles.shadeTopHeight }} />
                    <div
                      className="imageCropDialogShade imageCropDialogShadeBottom"
                      style={{ top: cropStyles.shadeBottomTop, height: cropStyles.shadeBottomHeight }}
                    />
                    <div
                      className="imageCropDialogShade imageCropDialogShadeLeft"
                      style={{ top: cropStyles.shadeSideTop, width: cropStyles.shadeLeftWidth, height: cropStyles.shadeSideHeight }}
                    />
                    <div
                      className="imageCropDialogShade imageCropDialogShadeRight"
                      style={{
                        top: cropStyles.shadeSideTop,
                        left: cropStyles.shadeRightLeft,
                        width: cropStyles.shadeRightWidth,
                        height: cropStyles.shadeSideHeight
                      }}
                    />

                    <div
                      className="imageCropDialogRect"
                      style={{ left: cropStyles.leftPct, top: cropStyles.topPct, width: cropStyles.widthPct, height: cropStyles.heightPct }}
                      onPointerDown={(e) => beginDrag(e, "move")}
                      role="presentation"
                    />
                  </div>

                  <button
                    className="imageCropDialogHandle imageCropDialogHandleNW"
                    type="button"
                    onPointerDown={(e) => beginDrag(e, "nw")}
                    aria-label="Resize crop from top left"
                    style={{ left: cropStyles.leftPct, top: cropStyles.topPct }}
                  />
                  <button
                    className="imageCropDialogHandle imageCropDialogHandleNE"
                    type="button"
                    onPointerDown={(e) => beginDrag(e, "ne")}
                    aria-label="Resize crop from top right"
                    style={{ left: cropStyles.rightPct, top: cropStyles.topPct }}
                  />
                  <button
                    className="imageCropDialogHandle imageCropDialogHandleSW"
                    type="button"
                    onPointerDown={(e) => beginDrag(e, "sw")}
                    aria-label="Resize crop from bottom left"
                    style={{ left: cropStyles.leftPct, top: cropStyles.bottomPct }}
                  />
                  <button
                    className="imageCropDialogHandle imageCropDialogHandleSE"
                    type="button"
                    onPointerDown={(e) => beginDrag(e, "se")}
                    aria-label="Resize crop from bottom right"
                    style={{ left: cropStyles.rightPct, top: cropStyles.bottomPct }}
                  />
                </>
              ) : (
                <div className="imageCropDialogPlaceholder">Loading preview...</div>
              )}
            </div>
          </div>
        </div>

        <div className="imageCropDialogMeta">
          <span>Drag corners to crop, or drag the box to move.</span>
        </div>
        {errorMessage ? <div className="imageCropDialogError">{errorMessage}</div> : null}
        <div className="rowActions modalFooterInline imageCropDialogActions">
          <button className="secondary" type="button" onClick={handleCancel}>
            Cancel
          </button>
          <button className="primary" type="button" onClick={handleConfirm} disabled={!isReady}>
            Crop image
          </button>
        </div>
      </div>
    </Modal>
  );
}
