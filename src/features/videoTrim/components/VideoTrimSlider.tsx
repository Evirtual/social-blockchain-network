import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

type SliderHandle = "start" | "end" | "window";

type Props = {
  minMs: number;
  maxMs: number;
  startMs: number;
  endMs: number;
  minWindowMs: number;
  maxWindowMs: number;
  disabled?: boolean;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
};

const STEP_MS = 100;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatValueText = (value: number) => {
  const seconds = Math.floor(value / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const ms = Math.round((value % 1000) / 10);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

export function VideoTrimSlider(props: Props) {
  const { minMs, maxMs, startMs, endMs, minWindowMs, maxWindowMs, disabled, onStartChange, onEndChange } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rangeDragState = useRef<{ start: number; end: number; pointerX: number } | null>(null);
  const handleOffset = useRef<Partial<Record<SliderHandle, number>>>({});
  const [activeHandle, setActiveHandle] = useState<SliderHandle | null>(null);

  const rangeMs = useMemo(() => Math.max(maxMs - minMs, 1), [minMs, maxMs]);

  const startPercent = useMemo(() => ((startMs - minMs) / rangeMs) * 100, [startMs, minMs, rangeMs]);
  const endPercent = useMemo(() => ((endMs - minMs) / rangeMs) * 100, [endMs, minMs, rangeMs]);

  const minStart = Math.max(minMs, endMs - maxWindowMs);
  const maxStart = Math.max(minMs, endMs - minWindowMs);
  const minEnd = Math.min(maxMs, startMs + minWindowMs);
  const maxEnd = Math.min(maxMs, startMs + maxWindowMs);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!activeHandle || disabled) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cursorX =
        activeHandle !== "window"
          ? event.clientX - (handleOffset.current[activeHandle] ?? 0)
          : event.clientX;
      const pct = clamp((cursorX - rect.left) / rect.width, 0, 1);
      const value = clamp(minMs + pct * rangeMs, minMs, maxMs);
      const normalized = Math.round(value);

      const clampSpan = (candidateSpan: number) => clamp(candidateSpan, minWindowMs, maxWindowMs);

      if (activeHandle === "window") {
        const drag = rangeDragState.current;
        if (!drag) return;
        const deltaMs = (event.clientX - drag.pointerX) / rect.width * rangeMs;
        const nextStart = clamp(drag.start + deltaMs, minMs, maxMs - (drag.end - drag.start));
        const nextEnd = nextStart + (drag.end - drag.start);
        if (nextStart !== startMs || nextEnd !== endMs) {
          onStartChange(nextStart);
          onEndChange(nextEnd);
        }
        return;
      }

      if (activeHandle === "start") {
        const candidateSpan = clampSpan(endMs - normalized);
        const nextStart = clamp(normalized, minMs, maxMs - candidateSpan);
        const nextEnd = nextStart + candidateSpan;
        if (nextStart !== startMs) onStartChange(nextStart);
        if (nextEnd !== endMs) onEndChange(nextEnd);
      } else {
        const candidateSpan = clampSpan(normalized - startMs);
        const nextEnd = clamp(normalized, minMs + candidateSpan, maxMs);
        const nextStart = clamp(nextEnd - candidateSpan, minMs, maxMs - candidateSpan);
        if (nextStart !== startMs) onStartChange(nextStart);
        if (nextEnd !== endMs) onEndChange(nextEnd);
      }
    },
    [
      activeHandle,
      disabled,
      minMs,
      maxMs,
      rangeMs,
      minWindowMs,
      maxWindowMs,
      startMs,
      endMs,
      onStartChange,
      onEndChange
    ]
  );

  useEffect(() => {
    if (!activeHandle) return;
    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault();
      handlePointerMove(event);
    };
    const onPointerUp = () => {
      setActiveHandle(null);
      rangeDragState.current = null;
      handleOffset.current = {};
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [activeHandle, handlePointerMove]);

  const handleDown = (handle: SliderHandle) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.preventDefault();
    setActiveHandle(handle);
    rangeDragState.current = null;
    const target = event.currentTarget.getBoundingClientRect();
    const center = target.left + target.width / 2;
    handleOffset.current[handle] = event.clientX - center;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleRangeDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      setActiveHandle("window");
      rangeDragState.current = { start: startMs, end: endMs, pointerX: event.clientX };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled, startMs, endMs]
  );

  const handleKeyDown =
    (handle: SliderHandle) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -STEP_MS : event.key === "ArrowRight" || event.key === "ArrowUp" ? STEP_MS : 0;
      if (!delta) return;
      event.preventDefault();
      if (handle === "start") {
        const next = clamp(startMs + delta, minStart, maxStart);
        if (next !== startMs) onStartChange(next);
      } else {
        const next = clamp(endMs + delta, minEnd, maxEnd);
        if (next !== endMs) onEndChange(next);
      }
    };

  return (
    <div className="videoTrimSlider" aria-hidden={disabled}>
      <div className="videoTrimSliderTrackContainer">
        <div className="videoTrimSliderTrack" ref={trackRef}>
          <div
            className="videoTrimSliderRange"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(endPercent - startPercent, 0)}%`
            }}
            onPointerDown={handleRangeDown}
          />
          <button
            type="button"
            className="videoTrimSliderHandle videoTrimSliderHandleStart"
            aria-label="Trim start"
            aria-valuemin={minMs}
            aria-valuemax={maxStart}
            aria-valuenow={startMs}
            aria-valuetext={formatValueText(startMs)}
            onPointerDown={handleDown("start")}
            onKeyDown={handleKeyDown("start")}
            disabled={Boolean(disabled)}
            style={{ left: `${startPercent}%` }}
            tabIndex={0}
          />
          <button
            type="button"
            className="videoTrimSliderHandle videoTrimSliderHandleEnd"
            aria-label="Trim end"
            aria-valuemin={minEnd}
            aria-valuemax={maxMs}
            aria-valuenow={endMs}
            aria-valuetext={formatValueText(endMs)}
            onPointerDown={handleDown("end")}
            onKeyDown={handleKeyDown("end")}
            disabled={Boolean(disabled)}
            style={{ left: `${endPercent}%` }}
            tabIndex={0}
          />
        </div>
      </div>
      <div className="videoTrimSliderTimes">
        <span className="videoTrimSliderTimeLabel">Start: {formatValueText(startMs)}</span>
        <span className="videoTrimSliderTimeLabel">End: {formatValueText(endMs)}</span>
      </div>
    </div>
  );
}
