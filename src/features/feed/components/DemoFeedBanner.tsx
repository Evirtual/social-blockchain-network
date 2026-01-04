import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconQuestion } from "@shared/components/icons";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { requestComposeNudge } from "@shared/lib/composeNudge";

export function DemoFeedBanner(props: { step: "connect" | "approve"; isLoading?: boolean }) {
  const firedForStepRef = useRef<string>("");
  const rootRef = useRef<HTMLElement | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const tooltipId = useId();

  useEffect(() => {
    if (firedForStepRef.current === props.step) return;
    firedForStepRef.current = props.step;

    if (props.step === "connect") requestConnectNudge();
    else requestComposeNudge();
  }, [props.step]);

  useEffect(() => {
    if (!isHelpOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsHelpOpen(false);
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(target)) return;
      setIsHelpOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [isHelpOpen]);

  const highlight = useMemo(() => {
    return {
      connect: props.step === "connect",
      approve: props.step === "approve"
    };
  }, [props.step]);

  return (
    <section
      ref={rootRef}
      className={`card hero demoFeedBanner ${props.isLoading ? "isLoading" : ""}`.trim()}
    >
      <button
        type="button"
        className="iconButton ghost heroClose"
        aria-label="About demo mode"
        aria-expanded={isHelpOpen}
        aria-controls={tooltipId}
        onClick={() => setIsHelpOpen((prev) => !prev)}
      >
        <IconQuestion size={22} />
      </button>

      {isHelpOpen ? (
        <div id={tooltipId} role="tooltip" className="demoFeedBannerTooltip">
          <div className="demoFeedBannerTooltipTitle">Why am I seeing this?</div>
          <div className="demoFeedBannerTooltipText muted">
            To protect the subgraph from request limits, access to the live feed is restricted. In demo mode you can
            browse sample posts, but you’ll need approval to load the real feed. Connect your wallet and create a post
            to request approval.
          </div>
        </div>
      ) : null}

      <>
          <div className="heroTitle">Demo mode</div>
          <div className="heroSub muted">
            {props.isLoading ? (
                "Checking approval status..."
            ) : (
            <>
            Live feed requests are limited. Please{" "}
            <span className={highlight.connect ? "demoFeedHighlight" : undefined}>connect</span> your wallet and then get{" "}
            <span className={highlight.approve ? "demoFeedHighlight" : undefined}>approved</span> to load the real subgraph feed.
            </>
            )}
          </div>
      </>
    </section>
  );
}
